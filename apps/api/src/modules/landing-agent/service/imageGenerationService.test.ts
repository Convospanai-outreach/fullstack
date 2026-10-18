import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockAiService } = vi.hoisted(() => ({
    mockAiService: { generateImage: vi.fn() },
}));

vi.mock("@/lib/aiService", () => ({ aiService: mockAiService }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { imageGenerationService } from "./imageGenerationService";

describe("imageGenerationService.generateSectionImage", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["SUPABASE_URL"] = "https://abcdefghijklmnopqrst.supabase.co";
        process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-key-1";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("is a no-op when Supabase Storage isn't configured", async () => {
        delete process.env["SUPABASE_SERVICE_ROLE_KEY"];

        const result = await imageGenerationService.generateSectionImage("a hero image", "team-1", "page-1-hero.png");

        expect(result.status).toBe("skipped");
        expect(mockAiService.generateImage).not.toHaveBeenCalled();
    });

    it("uploads the generated image bytes to the landing-images bucket and returns its public URL", async () => {
        mockAiService.generateImage.mockResolvedValue(Buffer.from("fake-png-bytes"));
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;

        const result = await imageGenerationService.generateSectionImage("a hero image", "team-1", "page-1-hero.png");

        expect(result.status).toBe("generated");
        expect(result.url).toBe("https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/public/landing-images/page-1-hero.png");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://abcdefghijklmnopqrst.supabase.co/storage/v1/object/landing-images/page-1-hero.png");
        expect(init.method).toBe("POST");
        expect(init.headers.Authorization).toBe("Bearer service-key-1");
        expect(init.headers["Content-Type"]).toBe("image/png");
    });

    it("returns an error result (not a thrown exception) when the upload fails", async () => {
        mockAiService.generateImage.mockResolvedValue(Buffer.from("fake-png-bytes"));
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" }) as any;

        const result = await imageGenerationService.generateSectionImage("a hero image", "team-1", "page-1-hero.png");

        expect(result.status).toBe("error");
    });
});
