import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        landingCampaign: { findFirst: vi.fn() },
        landingPage: { findUnique: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
        customDomain: { findMany: vi.fn() },
        landingExperiment: { findUnique: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/aiService", () => ({ aiService: {} }));
vi.mock("@/modules/learning/EventStore", () => ({ EventStore: { record: vi.fn() }, SystemEventType: {} }));
vi.mock("@/lib/governance/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/governance/guard", () => ({ enforcePolicy: vi.fn() }));
vi.mock("@/lib/outboxService", () => ({ OutboxService: { enqueue: vi.fn(), publishEvent: vi.fn() } }));
vi.mock("@/lib/blindIndexService", () => ({ BlindIndexService: { hash: vi.fn(), createBlindIndex: vi.fn() } }));
vi.mock("@/modules/governance/ApprovalService", () => ({ ApprovalService: { requestEntityApproval: vi.fn() } }));
vi.mock("./service/imageGenerationService", () => ({ imageGenerationService: { generateSectionImage: vi.fn() } }));

import { landingAgentService } from "./service";
import { setPageSlugSchema } from "./schemas";
import { APIError } from "@/lib/apiResponse";

function campaignWithPage(page: Record<string, unknown>) {
    return { id: "lc-1", teamId: "team-1", pages: [{ id: "lp-1", slug: "old-name", status: "draft", publishedAt: null, ...page }] };
}

describe("landingAgentService.setPageSlug", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.landingCampaign.findFirst.mockResolvedValue(campaignWithPage({}));
        mockPrisma.landingPage.findUnique.mockResolvedValue(null);
        mockPrisma.landingExperiment.findUnique.mockResolvedValue(null);
        mockPrisma.landingPage.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.landingPage.findUniqueOrThrow.mockResolvedValue({ id: "lp-1", slug: "spring-guide" });
    });

    it("changes the address of a page that has never been published", async () => {
        const page = await landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "spring-guide" });

        expect(mockPrisma.landingPage.updateMany).toHaveBeenCalledWith({ where: { id: "lp-1", teamId: "team-1" }, data: { slug: "spring-guide" } });
        expect(page).toEqual({ id: "lp-1", slug: "spring-guide" });
    });

    it("looks the campaign up within the team only", async () => {
        await landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "spring-guide" });

        expect(mockPrisma.landingCampaign.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lc-1", teamId: "team-1" } }));
    });

    it("refuses to change the address once the page has been published", async () => {
        mockPrisma.landingCampaign.findFirst.mockResolvedValue(campaignWithPage({ status: "published", publishedAt: new Date() }));

        const attempt = landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "spring-guide" });

        await expect(attempt).rejects.toBeInstanceOf(APIError);
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("refuses an address another page already uses", async () => {
        mockPrisma.landingPage.findUnique.mockResolvedValue({ id: "lp-other" });

        const attempt = landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "spring-guide" });

        await expect(attempt).rejects.toThrow("This web address is taken");
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("answers the same taken message when another request takes the address first", async () => {
        mockPrisma.landingPage.updateMany.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target: ["slug"] } }));

        const attempt = landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "spring-guide" });

        await expect(attempt).rejects.toMatchObject({ message: "This web address is taken. Try another.", statusCode: 409 });
    });

    it("refuses an address another test already uses", async () => {
        mockPrisma.landingExperiment.findUnique.mockResolvedValue({ id: "exp-other" });

        const attempt = landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "spring-guide" });

        await expect(attempt).rejects.toThrow("This web address is taken");
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("keeps the current address without a write when the path is unchanged", async () => {
        await landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "old-name" });

        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("keeps a legacy 64-character address without a write when it is saved unchanged", async () => {
        const legacy = "a".repeat(64);
        mockPrisma.landingCampaign.findFirst.mockResolvedValue(campaignWithPage({ slug: legacy }));

        const page = await landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: legacy });

        expect(page).toMatchObject({ slug: legacy });
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });

    it("refuses a new 64-character address before any write", async () => {
        const attempt = landingAgentService.setPageSlug({ teamId: "team-1", campaignId: "lc-1", pageId: "lp-1", path: "b".repeat(64) });

        await expect(attempt).rejects.toThrow("Use 2 to 63 letters, numbers or hyphens");
        expect(mockPrisma.landingPage.updateMany).not.toHaveBeenCalled();
    });
});

describe("setPageSlugSchema", () => {
    it("accepts a legacy 64-character path so the service can decide whether it is unchanged", () => {
        expect(setPageSlugSchema.safeParse({ path: "a".repeat(64) }).success).toBe(true);
    });
});
