import { beforeEach, describe, expect, it, vi } from "vitest";

// Regression for roadmap I-04: the revenue series used to load every CLOSED_WON
// lead ever, then reduce in memory. It must now bound the query to the ~30-day
// window it actually reads, without changing the computed series.

const { mockGetCurrentContext, mockPrisma } = vi.hoisted(() => ({
    mockGetCurrentContext: vi.fn(),
    mockPrisma: {
        lead: { count: vi.fn(), findMany: vi.fn() },
        meeting: { count: vi.fn() },
        campaign: { findMany: vi.fn() },
        auditLog: { findMany: vi.fn() },
    },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { GET } from "./route";

describe("dashboard route - revenue series query bound (I-04)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockPrisma.lead.count.mockResolvedValue(0);
        mockPrisma.meeting.count.mockResolvedValue(0);
        mockPrisma.campaign.findMany.mockResolvedValue([]);
        mockPrisma.auditLog.findMany.mockResolvedValue([]);
        mockPrisma.lead.findMany.mockResolvedValue([]);
    });

    it("bounds the CLOSED_WON load to the last ~month via wonAt/updatedAt, not all-time", async () => {
        await GET();

        const where = mockPrisma.lead.findMany.mock.calls[0][0].where;
        expect(where).toMatchObject({ teamId: "team-1", status: "CLOSED_WON" });
        expect(Array.isArray(where.OR)).toBe(true);

        // The cutoff must be at least 30 days back so it never clips the window.
        const cutoff: Date = where.OR[0].wonAt.gte;
        const daysBack = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
        expect(daysBack).toBeGreaterThanOrEqual(30);
        // Fallback branch covers leads with no wonAt.
        expect(where.OR[1]).toMatchObject({ wonAt: null });
        expect(where.OR[1].updatedAt.gte).toBeInstanceOf(Date);
    });

    it("still sums a won lead's value into its day bucket (behavior preserved)", async () => {
        // Build the won date with the same local-midnight construction the route
        // uses for its bucket keys, so the match holds regardless of the runner's
        // timezone (the local-vs-UTC key derivation is a pre-existing quirk).
        const now = new Date();
        const won = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 15);
        mockPrisma.lead.findMany.mockResolvedValue([{ value: 500, wonAt: won, updatedAt: won }]);

        const response = await GET();
        const body = await response.json();

        expect(body.revenueSeries).toHaveLength(30);
        const wonKey = won.toISOString().slice(0, 10);
        const bucket = body.revenueSeries.find((d: { day: string }) => d.day === wonKey);
        expect(bucket?.value).toBe(500);
    });
});
