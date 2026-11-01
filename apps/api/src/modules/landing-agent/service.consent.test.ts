import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingPage: { findFirst: vi.fn() },
        landingExperimentVariant: { findFirst: vi.fn().mockResolvedValue(null) },
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

import { OutboxService } from "@/lib/outboxService";
import { landingAgentService } from "./service";
import { encodeLeadFormMarkerId, type LeadFormConfig } from "./leadFormConfig";
import { landingLeadPayloadSchema } from "./schemas";

const TEXT = "I agree to be contacted about my enquiry.";
const email = { key: "email", label: "Work email", type: "email", required: true };
const requiredConfig = { fields: [email], buttonLabel: "Send", successMessage: "Thanks", consent: { enabled: true, required: true, text: TEXT } } as LeadFormConfig;
const optionalConfig = { fields: [email], buttonLabel: "Send", successMessage: "Thanks", consent: { enabled: true, required: false, text: TEXT } } as LeadFormConfig;
const plainConfig = { fields: [email], buttonLabel: "Send", successMessage: "Thanks" } as LeadFormConfig;

const markerFor = (config: LeadFormConfig) => `<section><div class="cmf-form" id="${encodeLeadFormMarkerId(config)}"></div></section>`;
const EVENT_ID = "11111111-2222-4333-8444-555555555555";
const TX = { landingLead: { create: vi.fn() }, landingEvent: { create: vi.fn() } };

function page(config: LeadFormConfig) {
    return {
        id: "lp-1",
        campaignId: "lc-1",
        teamId: "team-1",
        slug: "guide",
        version: 1,
        funnelStage: null,
        status: "published",
        tracking: { metaPixelId: "123456789012345" },
        renderedJson: { html: markerFor(config), css: "" },
    };
}

function submit(config: LeadFormConfig, formFields: Record<string, unknown>) {
    vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page(config) as never);
    return landingAgentService.submitLeadBySlug({
        slug: "guide",
        payload: {
            formFields: { email: "ada@example.com", ...formFields },
            metaEventId: EVENT_ID,
            metaEventSourceUrl: "https://go.brand.test/guide",
        },
        ipAddress: "168.212.226.204",
        userAgent: "Mozilla/5.0 (test)",
    } as never);
}

function createdData() {
    return vi.mocked(TX.landingLead.create).mock.calls[0]![0].data as { rawPayload?: Record<string, unknown> };
}

function metaEvents() {
    return vi.mocked(OutboxService.publishEvent).mock.calls.filter(([input]) => input.eventType === "LANDING_META_LEAD_CAPI");
}

describe("submitLeadBySlug consent", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        TX.landingLead.create.mockResolvedValue({ id: "ll-1" });
        (mockPrisma as unknown as { $transaction: unknown }).$transaction = vi.fn((run: (t: typeof TX) => unknown) => run(TX));
    });

    it("rejects a required consent that was not ticked, with a 400 and no lead saved", async () => {
        const promise = submit(requiredConfig, { consent: false });
        await expect(promise).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/consent/i) });
        expect(TX.landingLead.create).not.toHaveBeenCalled();
    });

    it("rejects a required consent that is missing from the submission", async () => {
        await expect(submit(requiredConfig, {})).rejects.toMatchObject({ statusCode: 400 });
        expect(TX.landingLead.create).not.toHaveBeenCalled();
    });

    it("saves a ticked consent as a record in rawPayload with the wording shown", async () => {
        await submit(requiredConfig, { consent: true });
        expect(createdData().rawPayload).toEqual({
            consent: { given: true, text: TEXT, at: expect.any(String), pageSlug: "guide", source: "landing_form" },
        });
    });

    it("records an optional consent left unticked as not given and still saves the lead", async () => {
        await submit(optionalConfig, { consent: false });
        expect(createdData().rawPayload).toMatchObject({ consent: { given: false, text: TEXT } });
        expect(TX.landingLead.create).toHaveBeenCalledTimes(1);
    });

    it("queues the Meta Lead event only when consent was given", async () => {
        await submit(requiredConfig, { consent: true });
        expect(metaEvents()).toHaveLength(1);
    });

    it("does not queue the Meta Lead event when an optional consent was not ticked", async () => {
        await submit(optionalConfig, { consent: false });
        expect(metaEvents()).toHaveLength(0);
    });

    it("queues the Meta Lead event on a page with no consent block, as before", async () => {
        await submit(plainConfig, {});
        expect(metaEvents()).toHaveLength(1);
        expect(createdData().rawPayload).toBeUndefined();
    });

    it("accepts a consent field in the lead payload", () => {
        expect(landingLeadPayloadSchema.safeParse({ consent: true }).success).toBe(true);
        expect(landingLeadPayloadSchema.safeParse({ consent: "yes" }).success).toBe(false);
    });
});
