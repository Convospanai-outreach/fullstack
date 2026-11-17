import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// The real dmFlowService runs against a mocked database, so the team filter is asserted on the
// queries it actually builds (not on a mocked service).
const mockDb = vi.hoisted(() => ({
    dmFlow: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    leadProperty: { findMany: vi.fn() },
}));
const audit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: audit } }));
vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: vi.fn() }));
vi.mock("@/lib/permissions", () => ({ checkTeamPermission: vi.fn(), TeamRole: { ADMIN: "admin", MEMBER: "member" } }));
vi.mock("@/modules/creator-funnel/featureGate", () => ({ isCreatorFunnelEnabled: vi.fn() }));

import { GET, POST } from "./route";
import { GET as GET_ONE, PATCH, DELETE } from "./[id]/route";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { checkTeamPermission } from "@/lib/permissions";
import { isCreatorFunnelEnabled } from "@/modules/creator-funnel/featureGate";

const BASE = "http://localhost:3001/content/dm-flows";
const json = (url: string, method: string, body: unknown) =>
    new NextRequest(url, { method, body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const params = (id = "flow-1") => ({ params: Promise.resolve({ id }) });

const steps = [
    { type: "message", text: "Thanks for asking" },
    { type: "question", text: "What is your budget?", property: "budget" },
    { type: "end" },
];

describe("/content/dm-flows routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (checkTeamPermission as any).mockResolvedValue(true);
        (isCreatorFunnelEnabled as any).mockResolvedValue(true);
        mockDb.leadProperty.findMany.mockResolvedValue([{ key: "budget" }]);
        mockDb.dmFlow.create.mockImplementation(async ({ data }: any) => ({ id: "flow-1", ...data }));
    });

    it("answers 401 without a signed-in team, and 404 when the creator funnel is off", async () => {
        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: null, teamId: null });
        expect((await GET(new NextRequest(BASE))).status).toBe(401);

        (getCurrentContextFromRequest as any).mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        (isCreatorFunnelEnabled as any).mockResolvedValue(false);
        expect((await GET(new NextRequest(BASE))).status).toBe(404);
        expect((await POST(json(BASE, "POST", { name: "Guide", steps }))).status).toBe(404);
        expect(mockDb.dmFlow.create).not.toHaveBeenCalled();
    });

    it("lists this team's active flows for any team member", async () => {
        mockDb.dmFlow.findMany.mockResolvedValue([{ id: "flow-1", name: "Guide" }]);
        (checkTeamPermission as any).mockResolvedValue(false);
        const res = await GET(new NextRequest(BASE));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ flows: [{ id: "flow-1", name: "Guide" }] });
        expect(mockDb.dmFlow.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", archivedAt: null } }));
    });

    it("403s a viewer's create, update and archive, and writes nothing", async () => {
        (checkTeamPermission as any).mockResolvedValue(false);
        expect((await POST(json(BASE, "POST", { name: "Guide", steps }))).status).toBe(403);
        expect((await PATCH(json(`${BASE}/flow-1`, "PATCH", { name: "x" }), params())).status).toBe(403);
        expect((await DELETE(new NextRequest(`${BASE}/flow-1`, { method: "DELETE" }), params())).status).toBe(403);
        expect(mockDb.dmFlow.create).not.toHaveBeenCalled();
        expect(mockDb.dmFlow.update).not.toHaveBeenCalled();
        expect(mockDb.dmFlow.updateMany).not.toHaveBeenCalled();
    });

    it("rejects a malformed body with 400 before the service runs", async () => {
        expect((await POST(json(BASE, "POST", { name: "", steps }))).status).toBe(400);
        expect((await POST(json(BASE, "POST", { name: "Guide", steps: "hello" }))).status).toBe(400);
        expect((await POST(json(BASE, "POST", { name: "Guide", steps: Array(13).fill({ type: "end" }) }))).status).toBe(400);
        expect((await PATCH(json(`${BASE}/flow-1`, "PATCH", { name: "x".repeat(101) }), params())).status).toBe(400);
        expect(mockDb.dmFlow.create).not.toHaveBeenCalled();
    });

    it("passes the service's step error through as 400 and does not save", async () => {
        const res = await POST(json(BASE, "POST", { name: "Guide", steps: [{ type: "end" }] }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("A flow needs at least one step before end.");
        expect(mockDb.dmFlow.create).not.toHaveBeenCalled();
    });

    it("creates a flow for the caller's team, ignoring any teamId in the body", async () => {
        const res = await POST(json(BASE, "POST", { name: "Guide", steps, teamId: "team-b" }));
        expect(res.status).toBe(201);
        expect(mockDb.dmFlow.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ teamId: "team-a", createdById: "user-1", name: "Guide" }),
        });
        expect(mockDb.dmFlow.create.mock.calls[0][0].data.teamId).not.toBe("team-b");
    });

    it("reads one flow only from the caller's team; another team's id is a 404", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue(null);
        const res = await GET_ONE(new NextRequest(`${BASE}/flow-of-team-b`), params("flow-of-team-b"));
        expect(res.status).toBe(404);
        expect(mockDb.dmFlow.findFirst).toHaveBeenCalledWith({ where: { id: "flow-of-team-b", teamId: "team-a", archivedAt: null } });
    });

    it("returns one of the caller's flows", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", name: "Guide", steps });
        const res = await GET_ONE(new NextRequest(`${BASE}/flow-1`), params());
        expect(await res.json()).toEqual({ flow: { id: "flow-1", name: "Guide", steps } });
    });

    it("updates a flow only inside the caller's team, and re-checks its steps", async () => {
        mockDb.dmFlow.findFirst.mockResolvedValue(null);
        expect((await PATCH(json(`${BASE}/flow-of-team-b`, "PATCH", { name: "Hijack" }), params("flow-of-team-b"))).status).toBe(404);
        expect(mockDb.dmFlow.findFirst).toHaveBeenCalledWith({ where: { id: "flow-of-team-b", teamId: "team-a", archivedAt: null } });
        expect(mockDb.dmFlow.update).not.toHaveBeenCalled();

        mockDb.dmFlow.findFirst.mockResolvedValue({ id: "flow-1", teamId: "team-a" });
        mockDb.dmFlow.update.mockResolvedValue({ id: "flow-1", name: "Guide", version: 2, steps });
        const ok = await PATCH(json(`${BASE}/flow-1`, "PATCH", { steps }), params());
        expect(ok.status).toBe(200);
        expect(mockDb.dmFlow.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "flow-1" } }));

        const bad = await PATCH(json(`${BASE}/flow-1`, "PATCH", { steps: [{ type: "question", text: "Budget?", property: "Not Valid" }] }), params());
        expect(bad.status).toBe(400);
    });

    it("archives (DELETE) only the caller's flow, and says 404 for another team's", async () => {
        mockDb.dmFlow.updateMany.mockResolvedValue({ count: 0 });
        const res = await DELETE(new NextRequest(`${BASE}/flow-of-team-b`, { method: "DELETE" }), params("flow-of-team-b"));
        expect(res.status).toBe(404);
        expect(mockDb.dmFlow.updateMany).toHaveBeenCalledWith({
            where: { id: "flow-of-team-b", teamId: "team-a", archivedAt: null },
            data: { archivedAt: expect.any(Date) },
        });

        mockDb.dmFlow.updateMany.mockResolvedValue({ count: 1 });
        const ok = await DELETE(new NextRequest(`${BASE}/flow-1`, { method: "DELETE" }), params());
        expect(await ok.json()).toEqual({ archived: true });
        expect(audit).toHaveBeenCalledWith("team-a", "user-1", "DM_FLOW_ARCHIVE", "DmFlow", "flow-1", {});
    });
});
