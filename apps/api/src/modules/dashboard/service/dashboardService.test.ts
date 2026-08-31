import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
        campaign: { count: vi.fn().mockResolvedValue(0), findMany: vi.fn().mockResolvedValue([]) },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { getDashboardStats } from "./dashboardService";

describe("getDashboardStats - every query is scoped to the given team", () => {
    beforeEach(() => vi.clearAllMocks());

    it("scopes lead/campaign counts and recent-item queries to teamId", async () => {
        await getDashboardStats("team-1");

        expect(mockPrisma.lead.count).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
        expect(mockPrisma.campaign.count).toHaveBeenCalledWith({ where: { teamId: "team-1" } });
        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1" } })
        );
        expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { teamId: "team-1" } })
        );
    });

    it("scopes the daily-activity counts to teamId too", async () => {
        await getDashboardStats("team-1");

        const dailyCountCalls = mockPrisma.lead.count.mock.calls.filter(
            ([arg]) => arg?.where?.createdAt !== undefined
        );
        expect(dailyCountCalls.length).toBeGreaterThan(0);
        for (const [arg] of dailyCountCalls) {
            expect(arg.where.teamId).toBe("team-1");
        }
    });
});
