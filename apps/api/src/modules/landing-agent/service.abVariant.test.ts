import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockOutbox } = vi.hoisted(() => {
    const prisma: Record<string, unknown> = {
        landingPage: { findFirst: vi.fn(), findUnique: vi.fn() },
        landingEvent: { create: vi.fn() },
        landingLead: { create: vi.fn() },
        landingExperimentVariant: { findFirst: vi.fn() },
        landingExperiment: { findUnique: vi.fn() },
    };
    prisma.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(prisma));
    return { mockPrisma: prisma, mockOutbox: { publishEvent: vi.fn() } };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: mockOutbox }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({ imageGenerationService: { generateSectionImage: vi.fn() } }));

import { landingAgentService } from "./service";

const HUMAN = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0";
const BOT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

const page = {
    id: "page-a",
    teamId: "team-1",
    campaignId: "lc-1",
    slug: "offer-a",
    status: "published",
    version: 3,
    funnelStage: null,
    renderedJson: { html: "<p>Offer</p>", css: "" },
};

beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(mockPrisma));
    mockPrisma.landingPage.findFirst.mockResolvedValue(page);
    mockPrisma.landingEvent.create.mockResolvedValue({ id: "ev-1" });
    mockPrisma.landingLead.create.mockResolvedValue({ id: "lead-1", email: null });
    mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue({ id: "var-a" });
});

describe("trackEventBySlug and the A/B variant", () => {
    it("records the variant the visitor saw on a page that is an arm of a running test", async () => {
        await landingAgentService.trackEventBySlug({ slug: "offer-a", eventName: "page_view", sessionId: "s1", userAgent: HUMAN });

        expect(mockPrisma.landingEvent.create.mock.calls[0][0].data.variantId).toBe("var-a");
    });

    it("records no variant for a crawler, and does not look the test up", async () => {
        await landingAgentService.trackEventBySlug({ slug: "offer-a", eventName: "page_view", sessionId: "s1", userAgent: BOT });

        expect(mockPrisma.landingEvent.create.mock.calls[0][0].data.variantId).toBeNull();
        expect(mockPrisma.landingExperimentVariant.findFirst).not.toHaveBeenCalled();
    });

    it("records no variant for a visitor who sent Do Not Track", async () => {
        await landingAgentService.trackEventBySlug({ slug: "offer-a", eventName: "page_view", sessionId: "s1", userAgent: HUMAN, doNotTrack: true });

        expect(mockPrisma.landingEvent.create.mock.calls[0][0].data.variantId).toBeNull();
    });

    it("records no variant for a page that is not in a test", async () => {
        mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue(null);

        await landingAgentService.trackEventBySlug({ slug: "offer-a", eventName: "page_view", sessionId: "s1", userAgent: HUMAN });

        expect(mockPrisma.landingEvent.create.mock.calls[0][0].data.variantId).toBeNull();
    });
});

describe("submitLeadBySlug and the A/B variant", () => {
    it("stores the variant on the lead and on the form_submit event", async () => {
        await landingAgentService.submitLeadBySlug({
            slug: "offer-a",
            payload: { sessionId: "s1", email: "pat@example.com" },
            userAgent: HUMAN,
        });

        expect(mockPrisma.landingLead.create.mock.calls[0][0].data.variantId).toBe("var-a");
        expect(mockPrisma.landingEvent.create.mock.calls[0][0].data.variantId).toBe("var-a");
    });

    it("stores no variant on a lead from a crawler", async () => {
        await landingAgentService.submitLeadBySlug({
            slug: "offer-a",
            payload: { sessionId: "s1", email: "pat@example.com" },
            userAgent: BOT,
        });

        expect(mockPrisma.landingLead.create.mock.calls[0][0].data.variantId).toBeNull();
    });
});
