import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        $queryRaw: vi.fn(),
        landingPage: { findFirst: vi.fn() },
        keywordTriggerReply: { count: vi.fn() },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { getFunnelReport } from "./funnelReportService";

const range = { from: new Date("2026-10-01T00:00:00.000Z"), to: new Date("2026-11-01T00:00:00.000Z") };

const ROW = {
    visits: 100,
    form_starts: 40,
    cta_clicks: 30,
    leads: 20,
    contacted: 15,
    replied: 5,
    meetings: 2,
    won: 1,
    qualified: 8,
    median_visit_to_form: 120,
    median_form_to_lead: 30,
    median_lead_to_contact: 3600,
    median_contact_to_reply: 7200,
    median_reply_to_meeting: 86400,
    median_meeting_to_won: null,
    median_lead_to_qualified: 600,
};

function sqlOf(callIndex = 0) {
    return mockDb.$queryRaw.mock.calls[callIndex][0] as { values: unknown[] };
}

describe("getFunnelReport", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.$queryRaw.mockResolvedValue([ROW]);
        mockDb.keywordTriggerReply.count.mockResolvedValue(42);
    });

    it("runs one aggregate query scoped to the team and the range", async () => {
        await getFunnelReport({ teamId: "team-1", range });
        expect(mockDb.$queryRaw).toHaveBeenCalledTimes(1);
        const { values } = sqlOf();
        expect(values).toContain("team-1");
        expect(values).toContainEqual(range.from);
        expect(values).toContainEqual(range.to);
    });

    it("counts Instagram keyword replies for the same team and range when no page or variant is chosen", async () => {
        const report = await getFunnelReport({ teamId: "team-1", range });
        expect(mockDb.keywordTriggerReply.count).toHaveBeenCalledWith({
            where: { teamId: "team-1", status: "SENT", createdAt: { gte: range.from, lt: range.to } },
        });
        expect(report.instagram).toEqual({ repliesSent: 42 });
    });

    it("checks the page belongs to the team before filtering by it, and filters the query by page and variant", async () => {
        mockDb.landingPage.findFirst.mockResolvedValue({ id: "page-9" });
        const report = await getFunnelReport({ teamId: "team-1", range, landingPageId: "page-9", variantId: "var-1" });
        expect(mockDb.landingPage.findFirst).toHaveBeenCalledWith({ where: { id: "page-9", teamId: "team-1" }, select: { id: true } });
        expect(sqlOf().values).toEqual(expect.arrayContaining(["page-9", "var-1", "team-1"]));
        expect(report.instagram).toBeNull();
        expect(mockDb.keywordTriggerReply.count).not.toHaveBeenCalled();
    });

    it("refuses a page that is not in the team, without running the query", async () => {
        mockDb.landingPage.findFirst.mockResolvedValue(null);
        await expect(getFunnelReport({ teamId: "team-1", range, landingPageId: "other-team-page" })).rejects.toMatchObject({ statusCode: 404 });
        expect(mockDb.$queryRaw).not.toHaveBeenCalled();
    });

    it("returns the assembled chain with drop-off from the query row", async () => {
        const report = await getFunnelReport({ teamId: "team-1", range });
        expect(report.steps.map((s) => [s.key, s.count, s.dropOffPercent])).toEqual([
            ["visit", 100, null],
            ["form_start", 40, 60],
            ["lead", 20, 50],
            ["first_contact", 15, 25],
            ["reply", 5, 66.7],
            ["meeting", 2, 60],
            ["won", 1, 50],
        ]);
    });
});
