import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }));

import { cloudflarePagesService } from "./cloudflarePagesService";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "../leadFormConfig";

const config = {
    fields: [{ key: "email", label: "Work email", type: "email", required: true }],
    buttonLabel: "Send it to me",
    successMessage: "Thanks! Check your inbox.",
} as LeadFormConfig;

describe("cloudflarePagesService.publishPageToCloudflare thank-you handle", () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct-1";
        process.env["CLOUDFLARE_API_TOKEN"] = "token-1";
        process.env["CLOUDFLARE_KV_NAMESPACE_ID"] = "ns-1";
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    async function publish(html: string) {
        const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
        global.fetch = fetchMock as never;
        mockPrisma.landingPage.findUnique.mockResolvedValue({
            id: "page-1",
            slug: "guide",
            title: "Guide",
            renderedJson: { html, css: "" },
            campaign: { teamId: "team-1" },
            team: { name: "Asha" },
            funnelStage: null,
        });
        await cloudflarePagesService.publishPageToCloudflare("page-1");
        return JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    }

    it("stores the handle with the page when the form has one", async () => {
        const body = await publish(`<section><div class="cmf-form" id="${encodeLeadFormMarkerId({ ...config, instagramHandle: "brand" })}"></div></section>`);
        expect(body.instagramHandle).toBe("brand");
    });

    it("stores no handle when the form has none", async () => {
        const body = await publish(`<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`);
        expect(body).not.toHaveProperty("instagramHandle");
    });

    it("stores the booking link with the page when the form has one", async () => {
        const body = await publish(`<section><div class="cmf-form" id="${encodeLeadFormMarkerId({ ...config, bookingUrl: "https://cal.example.com/intro" })}"></div></section>`);
        expect(body.bookingUrl).toBe("https://cal.example.com/intro");
    });

    it("stores no booking link when the form has none", async () => {
        const body = await publish(`<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`);
        expect(body).not.toHaveProperty("bookingUrl");
    });
});
