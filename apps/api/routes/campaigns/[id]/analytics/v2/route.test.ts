import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockAnalyticsService } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        lead: { groupBy: vi.fn() },
    },
    mockAnalyticsService: {
        getCampaignFunnel: vi.fn(),
        getActivityTimeline: vi.fn(),
    },
}));

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/prisma", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/modules/analytics/analyticsService", () => ({
    analyticsService: mockAnalyticsService,
}));

describe("GET /campaigns/[id]/analytics/v2 - cross-tenant scoping", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
    });

    it("returns 404 instead of another team's campaign analytics (cross-tenant IDOR)", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/campaigns/campaign-owned-by-team-b/analytics/v2") as any, {
            params: Promise.resolve({ id: "campaign-owned-by-team-b" }),
        });

        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-owned-by-team-b", teamId: "team-a" },
            select: { id: true },
        });
        expect(response.status).toBe(404);
        expect(mockAnalyticsService.getCampaignFunnel).not.toHaveBeenCalled();
    });

    it("returns analytics for a campaign owned by the caller's team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
        mockAnalyticsService.getCampaignFunnel.mockResolvedValue({ stage: "WARM" });
        mockAnalyticsService.getActivityTimeline.mockResolvedValue([]);
        mockPrisma.lead.groupBy.mockResolvedValue([{ status: "WARM", _count: { id: 3 } }]);

        const { GET } = await import("./route");
        const response = await GET(new Request("http://localhost/campaigns/campaign-1/analytics/v2") as any, {
            params: Promise.resolve({ id: "campaign-1" }),
        });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.leadsByStatus).toEqual({ WARM: 3 });
    });
});
