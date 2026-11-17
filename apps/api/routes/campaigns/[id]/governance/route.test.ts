import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ctx: vi.fn(), allowed: vi.fn(), campaign: vi.fn(), ids: vi.fn(), approvals: vi.fn(), audits: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/permissions", () => ({ hasPermission: m.allowed, Permission: { VIEW_AUDIT: "view_audit" } }));
vi.mock("@/lib/db", () => ({
    prisma: {
        campaign: { findFirst: m.campaign },
        $queryRaw: m.ids,
        approvalRequest: { findMany: m.approvals },
        auditLog: { findMany: m.audits },
    },
}));

import { GET } from "./route";

const call = () => GET(new Request("http://x"), { params: Promise.resolve({ id: "c1" }) });

beforeEach(() => {
    vi.resetAllMocks();
    m.ctx.mockResolvedValue({ userId: "u1", teamId: "t1" });
    m.allowed.mockResolvedValue(true);
    m.campaign.mockResolvedValue({ id: "c1" });
    m.ids.mockResolvedValue([]);
    m.approvals.mockResolvedValue([]);
    m.audits.mockResolvedValue([]);
});

describe("GET /campaigns/[id]/governance", () => {
    it("rejects unauthenticated callers", async () => {
        m.ctx.mockResolvedValue({});
        expect((await call()).status).toBe(401);
    });

    it("refuses callers without VIEW_AUDIT", async () => {
        m.allowed.mockResolvedValue(false);
        expect((await call()).status).toBe(403);
        expect(m.allowed).toHaveBeenCalledWith("u1", "t1", "view_audit");
        expect(m.campaign).not.toHaveBeenCalled();
    });

    it("404s for a campaign outside the team without reading approvals", async () => {
        m.campaign.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(m.campaign).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", teamId: "t1" } }));
        expect(m.approvals).not.toHaveBeenCalled();
    });

    it("asks the database for this campaign's approvals, inside the team, and reads only those", async () => {
        const base = { actionType: "MESSAGE_SEND", status: "PENDING", payload: {}, createdAt: new Date("2026-11-10T10:00:00Z"), reviewedAt: null, updatedAt: new Date("2026-11-10T10:00:00Z"), requester: null, reviewer: null };
        m.ids.mockResolvedValue([{ id: "held-message" }]);
        m.approvals.mockResolvedValue([{ ...base, id: "held-message", entityType: "Message", entityId: "l1:whatsapp" }]);
        const { data } = await (await call()).json();
        // The query's bound values include the team and the campaign.
        expect(m.ids.mock.calls[0][0].values).toEqual(expect.arrayContaining(["t1", "c1"]));
        expect(m.approvals).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1", id: { in: ["held-message"] } } }));
        expect(data.rows.map((r: { requestId: string }) => r.requestId)).toEqual(["held-message"]);
        expect(m.audits).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "t1", entity: "Campaign", entityId: "c1" } }));
    });

    it("skips the approvals read when none match", async () => {
        expect((await call()).status).toBe(200);
        expect(m.approvals).not.toHaveBeenCalled();
    });

    it("returns rows without payload values", async () => {
        m.ids.mockResolvedValue([{ id: "req-1" }]);
        m.approvals.mockResolvedValue([{
            id: "req-1", actionType: "SEND_EMAIL", entityType: "Lead", entityId: "l1", status: "PENDING", payload: { body: "secret draft text" },
            createdAt: new Date("2026-11-10T10:00:00Z"), reviewedAt: null, updatedAt: new Date("2026-11-10T10:00:00Z"),
            requester: { name: "Asha", email: "a@t.example" }, reviewer: null,
        }]);
        const res = await call();
        const text = JSON.stringify(await res.json());
        expect(text).toContain("req-1");
        expect(text).not.toContain("secret draft text");
    });

    it("flags a log cut at the row limit, and not a small one", async () => {
        m.audits.mockResolvedValue(Array.from({ length: 200 }, (_, n) => ({ id: `a${n}`, action: "UPDATE", correlationId: null, metadata: null, createdAt: new Date(1e12 + n), user: null })));
        expect((await (await call()).json()).data.capped).toBe(true);
    });

it("flags a log cut by rows even when fewer than 200 requests were read", async () => {        const t = new Date("2026-11-10T10:00:00Z");        const resolved = (n: number) => ({ id: `r${n}`, actionType: "SEND_EMAIL", entityType: "Lead", entityId: "l1", status: "APPROVED", payload: {}, createdAt: t, reviewedAt: t, updatedAt: t, requester: null, reviewer: null });        m.ids.mockResolvedValue(Array.from({ length: 101 }, (_, n) => ({ id: `r${n}` })));        m.approvals.mockResolvedValue(Array.from({ length: 101 }, (_, n) => resolved(n)));        m.audits.mockResolvedValue([{ id: "a1", action: "UPDATE", correlationId: null, metadata: null, createdAt: t, user: null }]);        const { data } = await (await call()).json();        expect(data.rows).toHaveLength(200);        expect(data.capped).toBe(true);    });
    it("does not flag small campaigns", async () => {
        expect((await (await call()).json()).data.capped).toBe(false);
    });
});
