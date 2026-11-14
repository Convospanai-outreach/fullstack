import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ ctx: vi.fn(), allowed: vi.fn(), campaign: vi.fn(), leads: vi.fn(), approvals: vi.fn(), audits: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: m.ctx }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: m.allowed, TeamRole: { MEMBER: "member" } }));
vi.mock("@/lib/db", () => ({
    prisma: {
        campaign: { findFirst: m.campaign },
        lead: { findMany: m.leads },
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
    m.leads.mockResolvedValue([{ id: "l1" }]);
    m.approvals.mockResolvedValue([]);
    m.audits.mockResolvedValue([]);
});

describe("GET /campaigns/[id]/governance", () => {
    it("rejects unauthenticated callers", async () => {
        m.ctx.mockResolvedValue({});
        expect((await call()).status).toBe(401);
    });

    it("refuses viewers", async () => {
        m.allowed.mockResolvedValue(false);
        expect((await call()).status).toBe(403);
        expect(m.campaign).not.toHaveBeenCalled();
    });

    it("404s for a campaign outside the team without reading approvals", async () => {
        m.campaign.mockResolvedValue(null);
        expect((await call()).status).toBe(404);
        expect(m.campaign).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "c1", teamId: "t1" } }));
        expect(m.approvals).not.toHaveBeenCalled();
    });

    it("reads approvals inside the team and keeps only this campaign's", async () => {
        const base = { actionType: "MESSAGE_SEND", status: "PENDING", payload: {}, createdAt: new Date("2026-11-10T10:00:00Z"), reviewedAt: null, updatedAt: new Date("2026-11-10T10:00:00Z"), requester: null, reviewer: null };
        m.approvals.mockResolvedValue([
            { ...base, id: "held-message", entityType: "Message", entityId: "l1:whatsapp" },
            { ...base, id: "other-campaign", entityType: "Campaign", entityId: "c2" },
            { ...base, id: "other-lead", entityType: "Lead", entityId: "l9" },
        ]);
        const { data } = await (await call()).json();
        expect(m.approvals).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "t1" } }));
        expect(data.rows.map((r: { requestId: string }) => r.requestId)).toEqual(["held-message"]);
        expect(m.audits).toHaveBeenCalledWith(expect.objectContaining({ where: { orgId: "t1", entity: "Campaign", entityId: "c1" } }));
    });

    it("returns rows without payload values", async () => {
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
});
