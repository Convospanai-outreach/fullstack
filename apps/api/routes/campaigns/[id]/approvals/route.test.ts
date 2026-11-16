import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ctx: vi.fn(), can: vi.fn(), campaign: vi.fn(), ids: vi.fn(), approvals: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/permissions", () => ({ hasPermission: m.can, Permission: { RESOLVE_APPROVALS: "resolve_approvals" } }));
vi.mock("@/lib/db", () => ({
    prisma: { campaign: { findFirst: m.campaign }, $queryRaw: m.ids, approvalRequest: { findMany: m.approvals } },
}));

import { GET } from "./route";

const call = () => GET(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });
const request = (over: Record<string, unknown>) => ({
    id: "r1", actionType: "MESSAGE_SEND", entityType: "Message", entityId: "l1:email", tier: "QUEUED", reason: null,
    payload: { subject: "Intro", body: "Hello there" }, autoDenyAt: new Date("2026-11-15T10:00:00Z"),
    createdAt: new Date("2026-11-14T10:00:00Z"), requester: { name: "Asha", email: "a@t.example" }, ...over,
});

beforeEach(() => {
    vi.resetAllMocks();
    m.ctx.mockResolvedValue({ userId: "u1", teamId: "t1" });
    m.can.mockResolvedValue(true);
    m.campaign.mockResolvedValue({ id: "c1" });
    m.ids.mockResolvedValue([]);
    m.approvals.mockResolvedValue([]);
});

describe("GET /campaigns/[id]/approvals", () => {
    it("rejects unauthenticated callers", async () => {
        m.ctx.mockResolvedValue({});
        expect((await call()).status).toBe(401);
    });

    it("404s for a campaign outside the team without reading approvals", async () => {
        m.campaign.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(m.campaign).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", teamId: "t1" } }));
        expect(m.approvals).not.toHaveBeenCalled();
    });

    it("asks the database for this campaign's pending requests, inside the team, and returns them", async () => {
        m.ids.mockResolvedValue([{ id: "r1" }]);
        m.approvals.mockResolvedValue([request({})]);
        const { data } = await (await call()).json();
        expect(m.ids.mock.calls[0][0].values).toEqual(expect.arrayContaining(["t1", "c1", "PENDING"]));
        expect(m.approvals).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1", status: "PENDING", id: { in: ["r1"] } } }));
        expect(data.requests).toHaveLength(1);
        expect(data.requests[0]).toMatchObject({
            requestId: "r1", requestedBy: "Asha", expiresAt: "2026-11-15T10:00:00.000Z", draft: { subject: "Intro", body: "Hello there" },
        });
    });

    it("skips the approvals read when nothing is pending", async () => {
        const { data } = await (await call()).json();
        expect(data.requests).toEqual([]);
        expect(m.approvals).not.toHaveBeenCalled();
    });

    it("tells the page whether this user may decide", async () => {
        m.can.mockResolvedValue(false);
        const { data } = await (await call()).json();
        expect(data.canDecide).toBe(false);
        expect(m.can).toHaveBeenCalledWith("u1", "t1", "resolve_approvals");
    });

    it("never reports a cap: nothing is truncated", async () => {
        expect((await (await call()).json()).data.capped).toBe(false);
    });
});
