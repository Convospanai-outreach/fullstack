import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockGetContext, mockCheckTeamPermission, mockPrisma, mockPlan, mockRun } = vi.hoisted(() => ({
    mockGetContext: vi.fn(),
    mockCheckTeamPermission: vi.fn(),
    mockPrisma: { lead: { findMany: vi.fn(), update: vi.fn() } },
    mockPlan: vi.fn(),
    mockRun: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentContextFromRequest: mockGetContext }));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/permissions", () => ({
    checkTeamPermission: mockCheckTeamPermission,
    TeamRole: { OWNER: "OWNER", ADMIN: "ADMIN", MEMBER: "MEMBER", VIEWER: "VIEWER" },
}));
vi.mock("@/lib/emailStatusBatch", () => ({ planEmailVerification: mockPlan, runEmailVerification: mockRun }));

import { POST } from "./route";

const call = (body: unknown) => POST(new NextRequest("http://localhost:3001/email/verify", { method: "POST", body: JSON.stringify(body) }));
const plan = { total: 3, skipped: 0, answeredFree: 1, providerChecks: 2 };

describe("POST /email/verify", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetContext.mockResolvedValue({ userId: "u1", teamId: "team-a" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockPrisma.lead.findMany.mockResolvedValue([{ id: "l1", email: "a@acme.com", emailStatus: "UNKNOWN" }]);
        mockPlan.mockResolvedValue(plan);
        mockRun.mockResolvedValue({ checked: 3, providerChecks: 2 });
    });

    it("rejects an unauthenticated caller and a caller who is not an admin", async () => {
        mockGetContext.mockResolvedValue({ userId: null, teamId: null });
        expect((await call({ leadIds: ["l1"] })).status).toBe(401);
        mockGetContext.mockResolvedValue({ userId: "u1", teamId: "team-a" });
        mockCheckTeamPermission.mockResolvedValue(false);
        expect((await call({ leadIds: ["l1"] })).status).toBe(403);
    });

    it("rejects an empty or oversized batch", async () => {
        expect((await call({ leadIds: [] })).status).toBe(400);
        expect((await call({ leadIds: Array.from({ length: 501 }, (_, i) => `l${i}`) })).status).toBe(400);
    });

    it("without a confirmation only previews the cost, and spends and saves nothing", async () => {
        const res = await call({ leadIds: ["l1"] });
        expect(await res.json()).toEqual({ plan });
        expect(mockRun).not.toHaveBeenCalled();
        expect(mockPrisma.lead.update).not.toHaveBeenCalled();
    });

    it("only reads leads of the caller's own team", async () => {
        await call({ leadIds: ["l1"] });
        expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: { in: ["l1"] }, teamId: "team-a" }) }));
    });

    it("runs when the confirmed count matches the plan", async () => {
        const res = await call({ leadIds: ["l1"], confirmProviderChecks: 2 });
        expect(await res.json()).toEqual({ result: { checked: 3, providerChecks: 2 } });
        expect(mockRun).toHaveBeenCalledTimes(1);
    });

    it("refuses to run when the cost has changed since the preview, and returns the new plan", async () => {
        const res = await call({ leadIds: ["l1"], confirmProviderChecks: 1 });
        expect(res.status).toBe(409);
        expect(await res.json()).toMatchObject({ plan });
        expect(mockRun).not.toHaveBeenCalled();
    });

    it("saves each result on the lead", async () => {
        mockRun.mockImplementation(async (_l: unknown, _d: unknown, save: (id: string, r: any) => Promise<void>) => {
            await save("l1", { status: "VERIFIED", source: "HUNTER", usedProvider: true });
            return { checked: 1, providerChecks: 1 };
        });
        await call({ leadIds: ["l1"], confirmProviderChecks: 2 });
        expect(mockPrisma.lead.update).toHaveBeenCalledWith({
            where: { id: "l1" },
            data: { emailStatus: "VERIFIED", emailStatusSource: "HUNTER", emailStatusCheckedAt: expect.any(Date) },
        });
    });
});
