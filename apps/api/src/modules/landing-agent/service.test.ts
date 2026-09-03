import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: { findFirst: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        landingPage: { update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: { askAI: vi.fn(), generateImage: vi.fn() } }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({
    imageGenerationService: { generateSectionImage: vi.fn() },
}));

import { landingAgentService } from "./service";
import { imageGenerationService } from "./service/imageGenerationService";

describe("landingAgentService's mutations scope by teamId, not just the campaign pre-check", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("generateImagesForPage scopes the final renderedJson write by teamId and surfaces a lost race instead of silently succeeding", async () => {
        const page = {
            id: "page-1",
            title: "t",
            status: "draft",
            renderedJson: { sections: [{ id: "sec-1", imagePrompt: "a hero image", imageUrl: undefined }] },
        };
        mockPrisma.landingCampaign.findFirst.mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            assets: [],
            wireframeOptions: [],
            pages: [page],
        });
        (imageGenerationService.generateSectionImage as any).mockResolvedValue({ status: "generated", url: "https://cdn.example.com/x.png" });
        mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 0 });

        await expect(
            landingAgentService.generateImagesForPage({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" })
        ).rejects.toThrow("Landing page not found");

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "page-1", teamId: "team-a" } })
        );
        expect(mockPrisma.landingPage.findUniqueOrThrow).not.toHaveBeenCalled();
    });

    it("generateImagesForPage returns the updated page when the scoped write succeeds", async () => {
        const page = {
            id: "page-1",
            title: "t",
            status: "draft",
            renderedJson: { sections: [{ id: "sec-1", imagePrompt: "a hero image", imageUrl: undefined }] },
        };
        mockPrisma.landingCampaign.findFirst.mockResolvedValue({
            id: "campaign-1",
            teamId: "team-a",
            assets: [],
            wireframeOptions: [],
            pages: [page],
        });
        (imageGenerationService.generateSectionImage as any).mockResolvedValue({ status: "generated", url: "https://cdn.example.com/x.png" });
        mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue({ ...page, renderedJson: { sections: [] } });

        const result = await landingAgentService.generateImagesForPage({ teamId: "team-a", campaignId: "campaign-1", pageId: "page-1" });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: "page-1", teamId: "team-a" } })
        );
        expect(result).toEqual({ ...page, renderedJson: { sections: [] } });
    });
});
