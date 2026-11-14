import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ctx: vi.fn(), can: vi.fn(), campaign: vi.fn(), leads: vi.fn(), approvals: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/permissions", () => ({ hasPermission: m.can, Permission: { RESOLVE_APPROVALS: "resolve_approvals" } }));
vi.mock("@/lib/db", () => ({
    prisma: { campaign: { findFirst: m.campaign }, lead: { findMany: m.leads }, approvalRequest: { findMany: m.approvals } },
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
    m.leads.mockResolvedValue([{ id: "l1" }]);
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

    it("returns only this campaign's pending requests, inside the team", async () => {
        m.approvals.mockResolvedValue([request({}), request({ id: "r2", entityId: "l9:email" }), request({ id: "r3", entityType: "Campaign", entityId: "c2", payload: {} })]);
        const { data } = await (await call()).json();
        expect(m.approvals).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1", status: "PENDING" } }));
        expect(data.requests).toHaveLength(1);
        expect(data.requests[0]).toMatchObject({
            requestId: "r1", requestedBy: "Asha", expiresAt: "2026-11-15T10:00:00.000Z", draft: { subject: "Intro", body: "Hello there" },
        });
    });

    it("tells the page whether this user may decide", async () => {
        m.can.mockResolvedValue(false);
        const { data } = await (await call()).json();
        expect(data.canDecide).toBe(false);
        expect(m.can).toHaveBeenCalledWith("u1", "t1", "resolve_approvals");
    });

    it("flags when the lead cap may have hidden older requests", async () => {
        m.leads.mockResolvedValue(Array.from({ length: 2000 }, (_, n) => ({ id: `l${n}` })));
        expect((await (await GET(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) })).json()).data.capped).toBe(true);
    });
});
