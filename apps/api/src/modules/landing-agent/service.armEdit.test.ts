import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: { findFirst: vi.fn() },
        landingPage: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
        landingExperimentVariant: { findFirst: vi.fn() },
    },
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: mockAudit }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({ imageGenerationService: { generateSectionImage: vi.fn() } }));

import { landingAgentService } from "./service";

const publishedB = {
    id: "lp-1",
    teamId: "team-1",
    campaignId: "lc-1",
    slug: "offer-b",
    title: "Offer B",
    status: "published",
    publishedAt: new Date("2026-10-01"),
    version: 2,
    renderedJson: { html: "<p>B</p>", css: "" },
    editorState: null,
};

function save(overrides: Record<string, unknown> = {}) {
    return landingAgentService.saveEditorState({
        teamId: "team-1",
        userId: "user-1",
        campaignId: "lc-1",
        renderedJson: { html: "<p>B edited</p>", css: "" },
        ...overrides,
    });
}

describe("saveEditorState on a page in a running A/B test", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.landingCampaign.findFirst.mockResolvedValue({ id: "lc-1", teamId: "team-1", pages: [publishedB], wireframeOptions: [], icp: null, assets: [] });
        mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue(publishedB);
        mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue(null);
    });

    it("records a note in the audit log naming the arm that was edited", async () => {
        mockPrisma.landingExperimentVariant.findFirst.mockResolvedValue({ id: "var-b", name: "B", experimentId: "exp-1" });

        await save();

        expect(mockPrisma.landingExperimentVariant.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({ where: { landingPageId: "lp-1", experiment: { status: "running" } } }),
        );
        expect(mockAudit).toHaveBeenCalledWith(
            expect.objectContaining({
                actorId: "user-1",
                orgId: "team-1",
                action: "landing_experiment.page_edited",
                entity: "LandingExperiment",
                entityId: "exp-1",
                metadata: expect.objectContaining({ pageId: "lp-1", variant: "B" }),
            }),
        );
    });

    it("records nothing for a page that is not an arm of a running test", async () => {
        await save();

        expect(mockAudit).not.toHaveBeenCalledWith(expect.objectContaining({ action: "landing_experiment.page_edited" }));
    });
});
