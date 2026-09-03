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
        process.env["CLOUDFLARE_LANDING_PAGES_ORIGIN"] = "https://pages.example.com";
        process.env["CLOUDFLARE_LANDING_PAGES_INTERNAL_SECRET"] = "secret-1";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("is a no-op when Cloudflare isn't configured", async () => {
        delete process.env["CLOUDFLARE_LANDING_PAGES_INTERNAL_SECRET"];

        const result = await imageGenerationService.generateSectionImage("a hero image", "team-1", "page-1-hero.png");

        expect(result.status).toBe("skipped");
        expect(mockAiService.generateImage).not.toHaveBeenCalled();
    });

    it("uploads the generated image bytes to the Worker's internal route and returns the public URL", async () => {
        mockAiService.generateImage.mockResolvedValue(Buffer.from("fake-png-bytes"));
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;

        const result = await imageGenerationService.generateSectionImage("a hero image", "team-1", "page-1-hero.png");

        expect(result.status).toBe("generated");
        expect(result.url).toBe("https://pages.example.com/assets/page-1-hero.png");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe("https://pages.example.com/internal/assets/page-1-hero.png");
        expect(init.method).toBe("POST");
        expect(init.headers["X-Internal-Secret"]).toBe("secret-1");
    });

    it("returns an error result (not a thrown exception) when the upload fails", async () => {
        mockAiService.generateImage.mockResolvedValue(Buffer.from("fake-png-bytes"));
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: async () => "unauthorized" }) as any;

        const result = await imageGenerationService.generateSectionImage("a hero image", "team-1", "page-1-hero.png");

        expect(result.status).toBe("error");
    });
});
