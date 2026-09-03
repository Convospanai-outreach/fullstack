import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
    prisma: {
        lead: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        campaign: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        email: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        meeting: {
            count: vi.fn(),
        },
        campaignVariant: {
            findMany: vi.fn(),
        },
        guardrailLog: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
    },
}));

import { prisma } from "@/lib/db";
import { analyticsService } from "../analyticsService";

describe("analyticsService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("getStats", () => {
        it("returns an empty shape when no teamId is given", async () => {
            const stats = await analyticsService.getStats(undefined);
            expect(stats).toEqual({ overview: {}, campaignPerformance: [] });
            expect(prisma.lead.count).not.toHaveBeenCalled();
        });

        it("computes email open/click rates from real Prisma data", async () => {
            (prisma.lead.count as any).mockResolvedValue(10);
            (prisma.campaign.count as any).mockResolvedValue(2);
            (prisma.campaign.findMany as any).mockResolvedValue([
                { id: "c1", name: "Campaign 1", targetCount: 100, completedCount: 40, status: "active" },
            ]);
            (prisma.email.findMany as any).mockResolvedValue([
                { status: "sent", openedAt: new Date(), clickedAt: null },
                { status: "delivered", openedAt: null, clickedAt: null },
                { status: "sent", openedAt: new Date(), clickedAt: new Date() },
            ]);

            const stats = await analyticsService.getStats("team-1");

            expect(stats.overview.totalLeads).toBe(10);
            expect(stats.overview.totalCampaigns).toBe(2);
            expect(stats.overview.emailStats).toEqual({
                total: 3,
                sent: 3,
                opened: 2,
                clicked: 1,
                openRate: (2 / 3) * 100,
                clickRate: (1 / 3) * 100,
            });
            expect(stats.campaignPerformance).toHaveLength(1);
        });
    });

    describe("getFunnelStats", () => {
        it("sums won-lead value as revenue, scoped to the team", async () => {
            (prisma.email.count as any).mockResolvedValueOnce(50).mockResolvedValueOnce(5);
            (prisma.meeting.count as any).mockResolvedValue(3);
            (prisma.lead.findMany as any).mockResolvedValue([{ value: 1000 }, { value: 500 }]);

            const stats = await analyticsService.getFunnelStats("team-1");

            expect(prisma.lead.findMany).toHaveBeenCalledWith({
                where: { teamId: "team-1", status: "CLOSED_WON" },
                select: { value: true },
            });
            expect(stats).toEqual({ outreach: 50, replied: 5, meetings: 3, deals: 2, revenue: 1500 });
        });
    });

    describe("getGovernanceStats", () => {
        it("counts guardrail logs, blocked actions, and derives a real risk level + hourly activity", async () => {
            (prisma.guardrailLog.count as any).mockResolvedValueOnce(20).mockResolvedValueOnce(4);
            const now = Date.now();
            (prisma.guardrailLog.findMany as any).mockResolvedValueOnce([
                { createdAt: new Date(now) }, // this hour
                { createdAt: new Date(now - 2 * 60 * 60 * 1000) }, // 2h ago
                { createdAt: new Date(now) }, // this hour
            ]);

            const stats = await analyticsService.getGovernanceStats("team-1");

            expect(prisma.guardrailLog.count).toHaveBeenNthCalledWith(1, { where: { teamId: "team-1" } });
            expect(prisma.guardrailLog.count).toHaveBeenNthCalledWith(2, {
                where: { teamId: "team-1", action: "blocked" },
            });
            expect(stats.totalLogs).toBe(20);
            expect(stats.blockedActions).toBe(4);
            expect(stats.policyRiskLevel).toBe("HIGH"); // 4/20 = 0.2 block ratio
            expect(stats.hourlyActivity).toHaveLength(24);
            expect(stats.hourlyActivity[23]).toBe(2); // this-hour bucket
            expect(stats.hourlyActivity[21]).toBe(1); // 2h-ago bucket
            expect(stats.hourlyActivity.reduce((a: number, b: number) => a + b, 0)).toBe(3);
        });

        it("reports LOW risk with no activity when there are no logs", async () => {
            (prisma.guardrailLog.count as any).mockResolvedValueOnce(0).mockResolvedValueOnce(0);
            (prisma.guardrailLog.findMany as any).mockResolvedValueOnce([]);

            const stats = await analyticsService.getGovernanceStats("team-1");

            expect(stats.policyRiskLevel).toBe("LOW");
            expect(stats.hourlyActivity.every((n: number) => n === 0)).toBe(true);
        });
    });

    describe("getVariantComparison", () => {
        it("derives open/reply rates from variant send counts", async () => {
            (prisma.campaignVariant.findMany as any).mockResolvedValue([
                { id: "v1", subject: "A", sentCount: 100, openCount: 40, replyCount: 10 },
                { id: "v2", subject: "B", sentCount: 0, openCount: 0, replyCount: 0 },
            ]);

            const result = await analyticsService.getVariantComparison("campaign-1", "team-1");

            expect(result[0]).toEqual({
                id: "v1",
                subject: "A",
                sentCount: 100,
                openCount: 40,
                replyCount: 10,
                openRate: 40,
                replyRate: 10,
            });
            expect(result[1].openRate).toBe(0);
        });

        it("scopes the query by the caller's teamId via the campaign relation", async () => {
            (prisma.campaignVariant.findMany as any).mockResolvedValue([]);

            await analyticsService.getVariantComparison("campaign-1", "team-1");

            expect(prisma.campaignVariant.findMany).toHaveBeenCalledWith({
                where: { campaignId: "campaign-1", campaign: { teamId: "team-1" } },
            });
        });
    });

    describe("getForecastingStats", () => {
        it("weights open pipeline by intentScore and sums won-lead revenue", async () => {
            (prisma.lead.findMany as any).mockResolvedValue([
                { status: "CLOSED_WON", value: 1000, intentScore: 0 },
                { status: "NEW", value: 2000, intentScore: 0.5 },
                { status: "CLOSED_LOST", value: 5000, intentScore: 0.9 },
            ]);

            const stats = await analyticsService.getForecastingStats("team-1");

            expect(stats.currentRevenue).toBe(1000);
            expect(stats.weightedPipeline).toBe(1000);
        });
    });
});
