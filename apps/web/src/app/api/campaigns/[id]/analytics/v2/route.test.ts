import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockPrisma, mockGetCampaignFunnel, mockGetActivityTimeline } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findFirst: vi.fn() },
        lead: { groupBy: vi.fn() },
    },
    mockGetCampaignFunnel: vi.fn(),
    mockGetActivityTimeline: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/analytics/analyticsService", () => ({
    analyticsService: {
        getCampaignFunnel: mockGetCampaignFunnel,
        getActivityTimeline: mockGetActivityTimeline,
    },
}));

function getRequest() {
    return new Request("http://localhost/api/campaigns/campaign-1/analytics/v2") as any;
}

function paramsFor(id: string) {
    return { params: Promise.resolve({ id }) };
}

describe("GET /api/campaigns/[id]/analytics/v2", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
    });

    it("rejects an unauthenticated caller", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./route");

        const response = await GET(getRequest(), paramsFor("campaign-1"));

        expect(response.status).toBe(401);
        expect(mockPrisma.campaign.findFirst).not.toHaveBeenCalled();
    });

    it("returns 404 for a campaign belonging to another team without querying analytics", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue(null);
        const { GET } = await import("./route");

        const response = await GET(getRequest(), paramsFor("campaign-1"));

        expect(response.status).toBe(404);
        expect(mockPrisma.campaign.findFirst).toHaveBeenCalledWith({
            where: { id: "campaign-1", teamId: "team-1" },
            select: { id: true },
        });
        expect(mockGetCampaignFunnel).not.toHaveBeenCalled();
        expect(mockGetActivityTimeline).not.toHaveBeenCalled();
        expect(mockPrisma.lead.groupBy).not.toHaveBeenCalled();
    });

    it("returns analytics for a campaign belonging to the caller's team", async () => {
        mockPrisma.campaign.findFirst.mockResolvedValue({ id: "campaign-1" });
        mockGetCampaignFunnel.mockResolvedValue({ sent: 1, opened: 0, clicked: 0, replied: 0 });
        mockGetActivityTimeline.mockResolvedValue([]);
        mockPrisma.lead.groupBy.mockResolvedValue([{ status: "NEW", _count: { id: 2 } }]);
        const { GET } = await import("./route");

        const response = await GET(getRequest(), paramsFor("campaign-1"));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.leadsByStatus).toEqual({ NEW: 2 });
    });
});
