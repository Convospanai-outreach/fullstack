import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { buildFullDocument, cloudflarePagesService } from "./cloudflarePagesService";
import { encodeLeadFormMarkerId } from "../leadFormConfig";

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

    it("publishes a themed page with the preset class and variables on the body", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "themed",
            title: "Themed",
            renderedJson: { html: "<p>Hello</p>", css: "", theme: { preset: "glass", primary: "#112233", accent: "#abcdef" } },
            campaign: { teamId: "team-1" },
        });
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;

        await cloudflarePagesService.publishPageToCloudflare("page-1");

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.html).toContain('<body class="la-page la-theme-glass" style="');
        expect(body.html).toContain("--la-primary:#112233");
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
        expect(body.html).not.toMatch(/<input[^>]*schecked[s/>]/);
        const script = [...body.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)][0]![1]!;
        expect(script).toContain('whatsappConsent: data.get("whatsappConsent") === "on" || undefined');
        expect(body.scriptHash).toBe(`sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`);

        mockPrisma.landingPage.findUnique.mockResolvedValue({ ...page, funnelStage: null });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        expect(JSON.parse(fetchMock.mock.calls[1][1].body).html).not.toContain('name="whatsappConsent"');
    });

    it("puts the page's tracking loaders in the one hashed script and flags the page for the Worker", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;
        const page = { id: "page-1", slug: "my-campaign", title: "My Campaign", renderedJson: { html: "<p>Hello</p>", css: "" }, campaign: { teamId: "team-1" } };

        mockPrisma.landingPage.findUnique.mockResolvedValue({ ...page, tracking: { ga4Id: "G-ABC1234", gtmId: "GTM-AB12CD", hotjarId: "1234567" } });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        const scripts = [...body.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)];
        expect(scripts).toHaveLength(1);
        expect(scripts[0]![1]).toContain("gtm.js?id=");
        expect(scripts[0]![1]).toContain('window.gtag("config", "G-ABC1234")');
        expect(scripts[0]![1]).toContain("hjid: 1234567");
        expect(scripts[0]![1]).toContain('var slug = "my-campaign"');
        expect(body.scriptHash).toBe(`sha256-${createHash("sha256").update(scripts[0]![1]!, "utf8").digest("base64")}`);
        expect(body.tracking).toBe(true);

        mockPrisma.landingPage.findUnique.mockResolvedValue({ ...page, tracking: null });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        const plain = JSON.parse(fetchMock.mock.calls[1][1].body);
        expect(plain.html).not.toContain("googletagmanager");
        expect(plain.tracking).toBeUndefined();
    });

    // Regression pin: a page with no Meta Pixel must publish exactly as it did before the Pixel existed,
    // so its stored document and script hash never change. Date is frozen because the lead script embeds Date.now().
    it("publishes a page without a Meta Pixel byte-for-byte as before", async () => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
        try {
            const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
            global.fetch = fetchMock as any;
            mockPrisma.landingPage.findUnique.mockResolvedValue({
                id: "page-1",
                slug: "plain",
                title: "Plain",
                renderedJson: { html: "<p>Hello</p>", css: "" },
                campaign: { teamId: "team-1" },
                tracking: { ga4Id: "G-ABC1234", hotjarId: "1234567" },
            });
            await cloudflarePagesService.publishPageToCloudflare("page-1");
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(createHash("sha256").update(body.html, "utf8").digest("hex")).toBe("6c98142beb816be687117a3d24d32a5a732b35a523d434caf85b38cbb1771dfa");
            const script = [...body.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)][0]![1]!;
            expect(body.scriptHash).toBe(`sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`);
            expect(body.metaPixel).toBeUndefined();
            expect(body.html).not.toContain("fbevents");
            expect(body.html).not.toContain("cmfMeta");
        } finally {
            vi.useRealTimers();
        }
    });

    it("adds the Meta Pixel to the one hashed script, flags the page, and fires Lead after a successful submit", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "my-campaign",
            title: "My Campaign",
            renderedJson: { html: "<p>Hello</p>", css: "" },
            campaign: { teamId: "team-1" },
            tracking: { metaPixelId: "123456789012345" },
        });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        const scripts = [...body.html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)];
        expect(scripts).toHaveLength(1);
        const script = scripts[0]![1]!;
        expect(script).toContain('window.fbq("init", "123456789012345")');
        expect(script).toContain('var slug = "my-campaign"');
        expect(body.scriptHash).toBe(`sha256-${createHash("sha256").update(script, "utf8").digest("base64")}`);
        expect(body.tracking).toBe(true);
        expect(body.metaPixel).toBe(true);
        // Lead fires only after the server accepted the submission, with the ID made for this submit.
        expect(script).toContain('var metaEventId = window.cmfMeta ? window.cmfMeta.newId() : null;');
        expect(script).toMatch(/if \(!res\.ok\) throw new Error\("Submission failed"\);\s*if \(metaEventId\) window\.cmfMeta\.track\("Lead", metaEventId\);/);
        // The lead POST carries the same ID, and the page URL without its query (the ?t= social token must not reach Meta).
        expect(script).toContain("metaEventId: metaEventId || undefined,");
        expect(script).toContain("metaEventSourceUrl: location.origin + location.pathname,");
    });

    it("sends no Meta fields from a page without a Meta Pixel", async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
        global.fetch = fetchMock as any;
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "plain",
            title: "Plain",
            renderedJson: { html: "<p>Hello</p>", css: "" },
            campaign: { teamId: "team-1" },
            tracking: { ga4Id: "G-ABC1234" },
        });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        const script = [...JSON.parse(fetchMock.mock.calls[0][1].body).html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\b[^>]*>/gi)][0]![1]!;
        expect(script).not.toContain("metaEventId");
        expect(script).not.toContain("metaEventSourceUrl");
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

describe("buildFullDocument lead form", () => {
    const config = { fields: [{ key: "email", label: "Work email", type: "email" as const, required: true }], buttonLabel: "Send it to me", successMessage: "Thanks!" };
    const doc = (html: string) => buildFullDocument({ title: "T", css: "", html, script: "", whatsappOptIn: null, slug: "guide" });

    it("a page without a marker keeps the fixed box at the bottom", () => {
        const out = doc("<p>Hi</p>");
        expect(out).toContain("Request a follow-up");
        expect(out).toContain('id="la-lead-form"');
        expect(out).not.toContain("data-cmf-form");
    });

    it("a page with a marker gets its form in place of the fixed box", () => {
        const marker = `<div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div>`;
        const out = doc(`<p>Hi</p>${marker}<p>After</p>`);
        expect(out).toContain('data-cmf-form="1"');
        expect(out).not.toContain("Request a follow-up");
        expect(out).not.toContain("cmf-form-");
        expect(out.indexOf("<p>Hi</p>")).toBeLessThan(out.indexOf("data-cmf-form"));
        expect(out.indexOf("data-cmf-form")).toBeLessThan(out.indexOf("<p>After</p>"));
    });
});
