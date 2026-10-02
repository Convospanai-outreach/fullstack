import { createHash } from "crypto";
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

    // S-09 (roadmap 3.3): the worker's CSP allows exactly this inline script by
    // hash, so the stored hash must match the served <script> text byte for byte.
    it("stores the sha256 CSP hash of the document's inline lead-form script", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "my-campaign",
            title: "My Campaign",
            renderedJson: { html: "<p>Hello</p>", css: "" },
            campaign: { teamId: "team-1" },
        });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;

        await cloudflarePagesService.publishPageToCloudflare("page-1");

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        const scripts = [...body.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)];
        expect(scripts).toHaveLength(1);
        const expected = `sha256-${createHash("sha256").update(scripts[0]![1]!, "utf8").digest("base64")}`;
        expect(body.scriptHash).toBe(expected);
        expect(scripts[0]![1]).toContain('var slug = "my-campaign"');
        // Creator funnel: the auto-reply link's ?t= goes along with the sign-up.
        expect(scripts[0]![1]).toContain('socialToken: url.searchParams.get("t") || undefined');
        // Attribution: every event carries the page URL's UTM.
        expect(scripts[0]![1]).toContain('utmSource: utm("utm_source"), utmMedium: utm("utm_medium"), utmCampaign: utm("utm_campaign")');
    });

    it("adds the WhatsApp opt-in checkbox, unticked and escaped, only on creator funnel pages", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;
        const page = { id: "page-1", slug: "guide", title: "Guide", renderedJson: { html: "<p>Hi</p>", css: "" }, campaign: { teamId: "team-1" }, team: { name: "Asha <b>& Co</b>" } };

        mockPrisma.landingPage.findUnique.mockResolvedValue({ ...page, funnelStage: "TOFU" });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.html).toContain('<input type="checkbox" name="whatsappConsent" style="margin-top:3px" />Yes, Asha &lt;b&gt;&amp; Co&lt;/b&gt; can message me on WhatsApp at the phone number above.');
        expect(body.html).not.toContain("checked");
        const script = [...body.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)][0]![1]!;
        expect(script).toContain('whatsappConsent: data.get("whatsappConsent") === "on" || undefined');
        expect(body.scriptHash).toBe(`sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`);

        mockPrisma.landingPage.findUnique.mockResolvedValue({ ...page, funnelStage: null });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).html).not.toContain('name="whatsappConsent"');
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
