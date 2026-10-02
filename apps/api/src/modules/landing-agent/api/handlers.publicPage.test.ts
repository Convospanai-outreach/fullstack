import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetPublicPageBySlug } = vi.hoisted(() => ({ mockGetPublicPageBySlug: vi.fn() }));

vi.mock("../service", () => ({
    landingAgentService: { getPublicPageBySlug: mockGetPublicPageBySlug },
}));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ authorizeRole: vi.fn(), TeamRole: {} }));

import { getPublicPage } from "./handlers";

// S-09 (roadmap 3.3): apps/web's /p/[slug] renders this JSON on the app's own
// origin, so the raw html must leave the API already sanitized.
describe("getPublicPage", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns renderedJson.html sanitized, other fields untouched", async () => {
        mockGetPublicPageBySlug.mockResolvedValue({
            id: "page-1",
            slug: "promo",
            title: "Promo",
            version: 3,
            campaignId: "camp-1",
            renderedJson: {
                html: '<section id="hero">Hi<img src=x onerror=alert(1)><svg onload=alert(1)></svg><script>alert(2)</script></section>',
                css: ".la-section{}",
            },
        });

        const res = await getPublicPage(new Request("http://localhost/landing-agent/public/promo/page"), {
            params: Promise.resolve({ slug: "promo" }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.renderedJson.html).toBe('<section id="hero">Hi<img /></section>');
        expect(json.renderedJson.css).toBe(".la-section{}");
        expect(json).toMatchObject({ id: "page-1", slug: "promo", version: 3, campaignId: "camp-1", whatsappOptIn: null });
    });

    it("gives creator funnel pages the WhatsApp opt-in text naming the business", async () => {
        mockGetPublicPageBySlug.mockResolvedValue({
            id: "page-1", slug: "guide", title: "Guide", version: 1, campaignId: "camp-1", funnelStage: "TOFU",
            team: { name: "Asha's Kitchen" }, renderedJson: { html: "<p>Hi</p>", css: "" },
        });
        const res = await getPublicPage(new Request("http://localhost/landing-agent/public/guide/page"), { params: Promise.resolve({ slug: "guide" }) });
        expect((await res.json()).whatsappOptIn).toBe("Yes, Asha's Kitchen can message me on WhatsApp at the phone number above.");
    });
});
