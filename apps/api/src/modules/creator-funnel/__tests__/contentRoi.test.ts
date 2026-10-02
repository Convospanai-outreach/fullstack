import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = vi.hoisted(() => ({
    contentPost: { findFirst: vi.fn(), findMany: vi.fn() },
    lead: { updateMany: vi.fn() },
    landingEvent: { groupBy: vi.fn() },
    landingLead: { groupBy: vi.fn() },
    order: { findMany: vi.fn() },
    leadActivity: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

import { getContentRoi, setFirstTouchPost } from "../contentRoi";

const NOW = new Date("2026-10-02T12:00:00Z");
const post = (id: string, body = `Post ${id}`) => ({
    id,
    body,
    funnelStage: "TOFU",
    targets: [{ publishedAt: new Date("2026-09-20T10:00:00Z"), socialAccount: { platform: "INSTAGRAM", handle: "@maker" } }],
});

describe("setFirstTouchPost", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.lead.updateMany.mockResolvedValue({ count: 1 });
    });

    it("records one of the team's posts, only when the lead has none yet", async () => {
        mockDb.contentPost.findFirst.mockResolvedValue({ id: "post-1" });
        await expect(setFirstTouchPost("team-a", "lead-1", "post-1")).resolves.toBe(true);
        expect(mockDb.contentPost.findFirst).toHaveBeenCalledWith({ where: { id: "post-1", teamId: "team-a" }, select: { id: true } });
        expect(mockDb.lead.updateMany).toHaveBeenCalledWith({ where: { id: "lead-1", teamId: "team-a", firstTouchPostId: null }, data: { firstTouchPostId: "post-1" } });
    });

    it("ignores ids that aren't the team's posts (utm_content is public input) and empty ones", async () => {
        mockDb.contentPost.findFirst.mockResolvedValue(null);
        await expect(setFirstTouchPost("team-a", "lead-1", "step-9")).resolves.toBe(false);
        await expect(setFirstTouchPost("team-a", "lead-1", null)).resolves.toBe(false);
        expect(mockDb.lead.updateMany).not.toHaveBeenCalled();
    });
});

describe("getContentRoi", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.contentPost.findMany.mockResolvedValue([post("post-p"), post("post-q")]);
        mockDb.landingEvent.groupBy.mockResolvedValue([]);
        mockDb.landingLead.groupBy.mockResolvedValue([]);
        mockDb.order.findMany.mockResolvedValue([]);
        mockDb.leadActivity.findMany.mockResolvedValue([]);
    });

    // The spec's chain: a comment on P gets an auto-reply DM (the lead's first touch = P), the link
    // (utm_content=P) brings a visit and an opt-in, then the lead checks out (no UTM on the order)
    // and pays. Rows are exactly what the producers write.
    it("credits comment -> DM -> opt-in -> checkout -> paid to the post the comment was on", async () => {
        mockDb.landingEvent.groupBy.mockResolvedValue([{ utmContent: "post-p", sessionId: "sess-1", _count: { _all: 2 } }]);
        mockDb.landingLead.groupBy.mockResolvedValue([{ utmContent: "post-p", _count: { _all: 1 } }]);
        mockDb.order.findMany.mockResolvedValue([{ amount: 49900, currency: "INR", utmContent: null, lead: { firstTouchPostId: "post-p" } }]);

        const report = await getContentRoi("team-a", 30, NOW);

        expect(report.posts[0]).toMatchObject({ id: "post-p", visits: 1, optIns: 1, purchases: 1, revenue: [{ currency: "INR", amount: 49900 }] });
        expect(report.posts[1]).toMatchObject({ id: "post-q", visits: 0, optIns: 0, purchases: 0, revenue: [] });
        expect(report.unattributed).toEqual({ purchases: 0, revenue: [] });
    });

    it("scopes every query to the team and the window", async () => {
        await getContentRoi("team-a", 7, NOW);
        const since = new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000);
        expect(mockDb.contentPost.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", targets: { some: { status: "PUBLISHED" } } } }));
        expect(mockDb.landingEvent.groupBy).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: "team-a", eventName: "page_view", createdAt: { gte: since }, utmContent: { in: ["post-p", "post-q"] } },
        }));
        expect(mockDb.landingLead.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ teamId: "team-a", createdAt: { gte: since } }) }));
        expect(mockDb.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", status: "CAPTURED", createdAt: { gte: since } } }));
        expect(mockDb.leadActivity.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ lead: { teamId: "team-a" }, createdAt: { gte: since } }) }));
    });

    it("counts a session once, events without a session each, and the order's own post before the lead's", async () => {
        mockDb.landingEvent.groupBy.mockResolvedValue([
            { utmContent: "post-q", sessionId: "s1", _count: { _all: 5 } },
            { utmContent: "post-q", sessionId: "s2", _count: { _all: 1 } },
            { utmContent: "post-q", sessionId: null, _count: { _all: 3 } },
        ]);
        mockDb.order.findMany.mockResolvedValue([
            { amount: 1000, currency: "INR", utmContent: "post-q", lead: { firstTouchPostId: "post-p" } },
            { amount: 2000, currency: "INR", utmContent: "step-1", lead: { firstTouchPostId: "post-other-team" } },
            { amount: 500, currency: "USD", utmContent: null, lead: null },
        ]);
        const report = await getContentRoi("team-a", 30, NOW);
        const q = report.posts.find((p) => p.id === "post-q")!;
        expect(q).toMatchObject({ visits: 5, purchases: 1, revenue: [{ currency: "INR", amount: 1000 }] });
        expect(report.posts.find((p) => p.id === "post-p")!.purchases).toBe(0);
        expect(report.unattributed).toEqual({ purchases: 2, revenue: [{ currency: "INR", amount: 2000 }, { currency: "USD", amount: 500 }] });
        expect(report.mainCurrency).toBe("INR");
    });

    it("ranks posts by revenue in the main currency", async () => {
        mockDb.order.findMany.mockResolvedValue([
            { amount: 1000, currency: "INR", utmContent: "post-p", lead: null },
            { amount: 9000, currency: "INR", utmContent: "post-q", lead: null },
        ]);
        const report = await getContentRoi("team-a", 30, NOW);
        expect(report.posts.map((p) => p.id)).toEqual(["post-q", "post-p"]);
    });

    it("converts stage to stage only for leads that actually reached both", async () => {
        mockDb.leadActivity.findMany.mockResolvedValue([
            { leadId: "a", metadata: { from: null, to: "TOFU" } },
            { leadId: "a", metadata: { from: "TOFU", to: "MOFU" } },
            { leadId: "b", metadata: { from: null, to: "TOFU" } },
            { leadId: "c", metadata: { from: null, to: "MOFU" } }, // opted in without a social touch first
            { leadId: "c", metadata: { from: "MOFU", to: "POST" } }, // bought without a checkout-start event
        ]);
        const report = await getContentRoi("team-a", 30, NOW);
        expect(report.stages).toEqual([
            { from: "TOFU", to: "MOFU", reached: 2, converted: 1, rate: 0.5 },
            { from: "MOFU", to: "BOFU", reached: 2, converted: 0, rate: 0 },
            { from: "BOFU", to: "POST", reached: 0, converted: 0, rate: null },
        ]);
    });

    it("skips the per-post queries when nothing is published", async () => {
        mockDb.contentPost.findMany.mockResolvedValue([]);
        const report = await getContentRoi("team-a", 30, NOW);
        expect(mockDb.landingEvent.groupBy).not.toHaveBeenCalled();
        expect(report.posts).toEqual([]);
    });
});
