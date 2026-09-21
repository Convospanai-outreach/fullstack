import { beforeEach, describe, expect, it, vi } from "vitest";

// Equivalence test for the I-04 rewrite: the route used to load every lead +
// usage log and reduce in memory; it now uses count/aggregate for all-time
// figures and a window-bounded query for the monthly history. These tests pin the
// output for a fixed dataset so the aggregate rewrite can't silently change a
// number.

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        campaign: { findMany: vi.fn() },
        lead: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
        lLMUsageLog: { aggregate: vi.fn(), findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

function req(url = "http://localhost/api/analytics/roi") {
    return new Request(url) as any;
}

describe("GET /analytics/roi - aggregate rewrite (I-04)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });

        // All-time figures (as the DB would return them for the dataset):
        // 5 leads total, 1 opportunity, 3 wins, revenue sum 1500, spend 200.
        mockPrisma.lead.count.mockImplementation(({ where }: any) => {
            if (where.status === "CLOSED_WON") return Promise.resolve(3);
            if (where.status?.in) return Promise.resolve(1);
            return Promise.resolve(5);
        });
        mockPrisma.lead.aggregate.mockResolvedValue({ _sum: { value: 1500 } });
        mockPrisma.lLMUsageLog.aggregate.mockResolvedValue({ _sum: { cost: 200 } });

        // In-window CLOSED_WON leads: one with a value, one with a null value and
        // null wonAt (falls back to updatedAt) - both dated to the current month.
        const now = new Date();
        const midThisMonth = new Date(now.getFullYear(), now.getMonth(), 15, 12, 0, 0);
        mockPrisma.lead.findMany.mockResolvedValue([
            { value: 1000, wonAt: midThisMonth, updatedAt: midThisMonth },
            { value: null, wonAt: null, updatedAt: midThisMonth },
        ]);
        mockPrisma.lLMUsageLog.findMany.mockResolvedValue([
            { cost: 200, createdAt: midThisMonth },
        ]);

        mockPrisma.campaign.findMany.mockResolvedValue([
            {
                id: "c1",
                name: "Q1",
                status: "active",
                _count: { emails: 10, leadList: 5 },
                variants: [{ openCount: 5, replyCount: 2 }],
            },
        ]);
    });

    it("reproduces the funnel/financial figures the in-memory reduce produced", async () => {
        const res = await GET(req());
        const body = await res.json();

        expect(body.funnel).toEqual({
            totalLeads: 5,
            totalSent: 10,
            opportunities: 1,
            wins: 3,
            conversionRate: 60, // 3/5 * 100
        });
        expect(body.financials).toEqual({
            spend: 200,
            revenue: 1500,
            roi: 650, // (1500-200)/200 * 100
            profit: 1300,
        });
        expect(body.campaigns).toEqual([
            { id: "c1", name: "Q1", sent: 10, openRate: 50, replyRate: 20, status: "active" },
        ]);
    });

    it("buckets in-window revenue/spend into the current month and zeros the rest", async () => {
        const res = await GET(req());
        const body = await res.json();

        expect(body.history).toHaveLength(6);
        const now = new Date();
        const currentKey = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 7);
        const current = body.history.find((h: { date: string }) => h.date === currentKey);
        expect(current).toEqual({ date: currentKey, revenue: 1000, spend: 200 });

        // Every other month bucket is empty for this dataset.
        const others = body.history.filter((h: { date: string }) => h.date !== currentKey);
        expect(others.every((h: { revenue: number; spend: number }) => h.revenue === 0 && h.spend === 0)).toBe(true);
    });

    it("derives the history window from the caller's months param (guards deep windows)", async () => {
        await GET(req("http://localhost/api/analytics/roi?months=24"));

        const now = new Date();
        const expectedCutoff = new Date(now.getFullYear(), now.getMonth() - 23, 1);
        const leadHistoryCall = mockPrisma.lead.findMany.mock.calls[0][0];
        const cutoff: Date = leadHistoryCall.where.OR[0].wonAt.gte;
        expect(cutoff.getFullYear()).toBe(expectedCutoff.getFullYear());
        expect(cutoff.getMonth()).toBe(expectedCutoff.getMonth());
        // The history query stays scoped to won leads via both OR branches - if
        // this predicate were dropped, non-won leads would inflate every bucket
        // (the in-reduce status guard is gone now that the query filters).
        expect(leadHistoryCall.where.status).toBe("CLOSED_WON");
        expect(leadHistoryCall.where.OR[1]).toMatchObject({ wonAt: null });
        // Usage-log history uses the same cutoff.
        expect(mockPrisma.lLMUsageLog.findMany.mock.calls[0][0].where.createdAt.gte.getTime()).toBe(cutoff.getTime());
    });

    it("treats empty aggregates (null _sum) as zero", async () => {
        mockPrisma.lead.aggregate.mockResolvedValue({ _sum: { value: null } });
        mockPrisma.lLMUsageLog.aggregate.mockResolvedValue({ _sum: { cost: null } });

        const res = await GET(req());
        const body = await res.json();

        expect(body.financials).toEqual({ spend: 0, revenue: 0, roi: 0, profit: 0 });
    });

    it("rejects an unauthenticated caller before running any query", async () => {
        mockGetCurrentContext.mockResolvedValue({ teamId: null });

        const res = await GET(req());

        expect(res.status).toBe(401);
        expect(mockPrisma.lead.count).not.toHaveBeenCalled();
    });
});
