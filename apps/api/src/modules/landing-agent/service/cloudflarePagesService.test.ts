import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { cloudflarePagesService } from "./cloudflarePagesService";

describe("cloudflarePagesService.publishPageToCloudflare", () => {
    const originalEnv = { ...process.env };
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct-1";
        process.env["CLOUDFLARE_API_TOKEN"] = "token-1";
        process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = "ns-1";
    });

    afterEach(() => {
        process.env = { ...originalEnv };
        global.fetch = originalFetch;
    });

    it("is a no-op when Cloudflare isn't configured", async () => {
        delete process.env["CLOUDFLARE_API_TOKEN"];

        const result = await cloudflarePagesService.publishPageToCloudflare("page-1");

        expect(result.status).toBe("skipped");
        expect(mockPrisma.landingPage.findUnique).not.toHaveBeenCalled();
    });

    it("PUTs the rendered HTML and owning teamId to the correct KV key", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "my-campaign",
            title: "My Campaign",
            renderedJson: { html: "<p>Hello</p>", css: "" },
            campaign: { teamId: "team-1" },
        });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;

        const result = await cloudflarePagesService.publishPageToCloudflare("page-1");

        expect(result.status).toBe("pushed");
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
            "https://api.cloudflare.com/client/v4/accounts/acct-1/storage/kv/namespaces/ns-1/values/page:my-campaign"
        );
        expect(init.method).toBe("PUT");
        expect(init.headers.Authorization).toBe("Bearer token-1");
        const body = JSON.parse(init.body);
        expect(body.teamId).toBe("team-1");
        expect(body.html).toContain("Hello");
        expect(body.html).toContain("la-lead-form");
    });

    it("returns an error result (not a thrown exception) when the Cloudflare API call fails", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "my-campaign",
            title: "My Campaign",
            renderedJson: { html: "<p>Hello</p>", css: "" },
            campaign: { teamId: "team-1" },
        });
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => "forbidden" }) as any;

        const result = await cloudflarePagesService.publishPageToCloudflare("page-1");

        expect(result.status).toBe("error");
    });
});
