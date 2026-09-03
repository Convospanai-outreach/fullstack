import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentContext, mockGetDashboardStats } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockGetDashboardStats: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("../service/dashboardService", () => ({ getDashboardStats: mockGetDashboardStats }));

describe("GET /api/dashboard/stats - requires auth and is scoped to the caller's team", () => {
    beforeEach(() => vi.clearAllMocks());

    it("rejects an unauthenticated caller instead of returning global cross-tenant stats", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null, teamId: null });
        const { GET } = await import("./stats");

        const response = await GET();

        expect(response.status).toBe(401);
        expect(mockGetDashboardStats).not.toHaveBeenCalled();
    });

    it("passes the caller's own teamId to getDashboardStats", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockGetDashboardStats.mockResolvedValue({ leadsCount: 0, campaignsCount: 0, recentLeads: [], recentCampaigns: [], dailyActivity: [] });
        const { GET } = await import("./stats");

        await GET();

        expect(mockGetDashboardStats).toHaveBeenCalledWith("team-1");
    });
});
