import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findFirst: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: { askAI: vi.fn(), generateImage: vi.fn() } }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({
    imageGenerationService: { generateSectionImage: vi.fn() },
}));

import { landingAgentService } from "./service";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "./leadFormConfig";

const config = {
    fields: [
        { key: "name", label: "Full name", type: "text", required: true },
        { key: "email", label: "Work email", type: "email", required: true },
        { key: "budget", label: "Budget", type: "select", required: true, options: ["Under $1k", "Over $5k"] },
        { key: "consent", label: "Send tips", type: "checkbox", required: false },
    ],
    buttonLabel: "Send",
    successMessage: "Thanks",
} as LeadFormConfig;

const marker = `<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`;

function page(html: string | null, extra: Record<string, unknown> = {}) {
    return {
        id: "lp-1",
        campaignId: "lc-1",
        teamId: "team-1",
        slug: "guide",
        version: 1,
        funnelStage: null,
        renderedJson: html === null ? { sections: [] } : { html, css: "" },
        ...extra,
    };
}

function captureLead() {
    const tx = { landingLead: { create: vi.fn().mockResolvedValue({ id: "ll-1" }) }, landingEvent: { create: vi.fn() } };
    (mockPrisma as unknown as { $transaction: unknown }).$transaction = vi.fn((run: (t: typeof tx) => unknown) => run(tx));
    return tx.landingLead.create;
}

describe("submitLeadBySlug with a lead form marker", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("puts mapped fields in their columns and the rest in rawPayload.answers", async () => {
        const create = captureLead();
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page(marker) as never);
        await landingAgentService.submitLeadBySlug({
            slug: "guide",
            payload: { email: "spoofed@example.com", formFields: { name: "Ada", email: "ada@example.com", budget: "Over $5k", consent: true } },
        });
        const data = create.mock.calls[0]![0].data;
        expect(data.name).toBe("Ada");
        expect(data.email).toBe("ada@example.com");
        expect(data.rawPayload).toEqual({ answers: { budget: "Over $5k", consent: true } });
    });

    it("rejects a key that is not in the page's form", async () => {
        const create = captureLead();
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page(marker) as never);
        await expect(
            landingAgentService.submitLeadBySlug({
                slug: "guide",
                payload: { formFields: { name: "Ada", email: "ada@example.com", budget: "Over $5k", admin: "yes" } },
            })
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(create).not.toHaveBeenCalled();
    });

    it("rejects a missing required field and an oversize answer with 400", async () => {
        const create = captureLead();
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page(marker) as never);
        await expect(
            landingAgentService.submitLeadBySlug({ slug: "guide", payload: { formFields: { email: "ada@example.com", budget: "Over $5k" } } })
        ).rejects.toMatchObject({ statusCode: 400 });
        const longConfig = {
            ...config,
            fields: [...config.fields, { key: "goal", label: "Goal", type: "textarea", required: false }],
        } as LeadFormConfig;
        const longPage = page(`<section><div class="cmf-form" id="${encodeLeadFormMarkerId(longConfig)}"></div></section>`);
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(longPage as never);
        await expect(
            landingAgentService.submitLeadBySlug({
                slug: "guide",
                payload: { formFields: { name: "Ada", email: "ada@example.com", budget: "Over $5k", goal: "x".repeat(1001) } },
            })
        ).rejects.toMatchObject({ statusCode: 400 });
        expect(create).not.toHaveBeenCalled();
    });

    it("a marker whose config is invalid refuses the submission", async () => {
        const create = captureLead();
        const bad = page(`<section><div class="cmf-form" id="cmf-form-bm90LWpzb24"></div></section>`);
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(bad as never);
        await expect(landingAgentService.submitLeadBySlug({ slug: "guide", payload: { formFields: {} } })).rejects.toMatchObject({
            statusCode: 400,
        });
        expect(create).not.toHaveBeenCalled();
    });

    it("a page without a marker still stores the fixed box fields and ignores formFields", async () => {
        const create = captureLead();
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page("<p>Hi</p>") as never);
        await landingAgentService.submitLeadBySlug({
            slug: "guide",
            payload: { name: "Asha", email: "asha@example.com", phone: "+91 98765 43210", formFields: { goal: "ignored" }, rawPayload: { note: "kept" } },
        });
        const data = create.mock.calls[0]![0].data;
        expect(data.name).toBe("Asha");
        expect(data.email).toBe("asha@example.com");
        expect(data.phone).toBe("+91 98765 43210");
        expect(data.rawPayload).toEqual({ note: "kept" });
    });
});
