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

const EVENT_ID = "11111111-2222-4333-8444-555555555555";
const TX = { landingLead: { create: vi.fn() }, landingEvent: { create: vi.fn() } };

function page(tracking: unknown) {
    return {
        id: "lp-1",
        campaignId: "lc-1",
        teamId: "team-1",
        slug: "guide",
        version: 1,
        funnelStage: null,
        status: "published",
        tracking,
        renderedJson: { html: "<p>Offer</p>", css: "" },
    };
}

function submit(overrides: { payload?: Record<string, unknown>; doNotTrack?: boolean; metaCookies?: { fbc?: string; fbp?: string } } = {}) {
    return landingAgentService.submitLeadBySlug({
        slug: "guide",
        payload: {
            name: "Mary Smith",
            email: "john_smith@gmail.com",
            phone: "+1 (650) 555-1212",
            metaEventId: EVENT_ID,
            metaEventSourceUrl: "https://go.brand.test/guide",
            ...overrides.payload,
        },
        ipAddress: "168.212.226.204",
        userAgent: "Mozilla/5.0 (test)",
        doNotTrack: overrides.doNotTrack,
        metaCookies: overrides.metaCookies,
    } as never);
}

function metaEvents() {
    return vi.mocked(OutboxService.publishEvent).mock.calls.filter(([input]) => input.eventType === "LANDING_META_LEAD_CAPI");
}

describe("submitLeadBySlug Meta Lead event", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        TX.landingLead.create.mockResolvedValue({ id: "ll-1" });
        (mockPrisma as unknown as { $transaction: unknown }).$transaction = vi.fn((run: (t: typeof TX) => unknown) => run(TX));
    });

    it("queues one server Lead in the same transaction, with the browser's event ID and the visitor's Meta cookies", async () => {
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page({ metaPixelId: "123456789012345", metaTestEventCode: "TEST12345" }) as never);
        await submit({ metaCookies: { fbc: "fb.1.1800000000000.IwAR", fbp: "fb.1.1800000000000.123" } });

        const events = metaEvents();
        expect(events).toHaveLength(1);
        const [input, client] = events[0]!;
        expect(client).toBe(TX);
        expect(input).toMatchObject({
            teamId: "team-1",
            aggregateType: "LandingLead",
            aggregateId: "ll-1",
            idempotencyKey: "landing_lead_meta_ll-1",
        });
        expect(input.payload).toMatchObject({
            pixelId: "123456789012345",
            eventId: EVENT_ID,
            eventSourceUrl: "https://go.brand.test/guide",
            fbc: "fb.1.1800000000000.IwAR",
            fbp: "fb.1.1800000000000.123",
            testEventCode: "TEST12345",
        });
        expect(typeof input.payload.eventTime).toBe("number");
    });

    it("keeps personal data out of the outbox payload (the job reads it from the lead)", async () => {
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page({ metaPixelId: "123456789012345" }) as never);
        await submit();
        const serialized = JSON.stringify(metaEvents()[0]![0].payload);
        expect(serialized).not.toContain("john_smith");
        expect(serialized).not.toContain("650");
        expect(serialized).not.toContain("Mary");
    });

    it("queues nothing for a page without a Meta Pixel", async () => {
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page({ ga4Id: "G-ABC1234" }) as never);
        await submit();
        expect(metaEvents()).toHaveLength(0);
    });

    it("queues nothing for a Do Not Track or Global Privacy Control visitor", async () => {
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page({ metaPixelId: "123456789012345" }) as never);
        await submit({ doNotTrack: true });
        expect(metaEvents()).toHaveLength(0);
    });

    it("queues nothing when the browser sent no event ID (its Pixel was not loaded)", async () => {
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page({ metaPixelId: "123456789012345" }) as never);
        await submit({ payload: { metaEventId: undefined, metaEventSourceUrl: undefined } });
        expect(metaEvents()).toHaveLength(0);
    });

    it("still saves the lead when the page has no Meta Pixel", async () => {
        vi.spyOn(landingAgentService, "getPublicPageBySlug").mockResolvedValue(page(null) as never);
        const result = await submit();
        expect(result.lead.id).toBe("ll-1");
    });
});
