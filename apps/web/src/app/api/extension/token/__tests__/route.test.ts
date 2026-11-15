import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSessionCreate, mockSessionDeleteMany, mockGetCurrentContext, mockTeamFindUnique, mockAudit, mockTx, mockGetToken, mockQueryRaw } = vi.hoisted(() => ({
    mockGetToken: vi.fn(),
    mockQueryRaw: vi.fn(),
    mockTeamFindUnique: vi.fn(),
    mockSessionCreate: vi.fn(),
    mockSessionDeleteMany: vi.fn(),
    mockGetCurrentContext: vi.fn(),
    mockAudit: vi.fn(),
    // What the route sees inside prisma.$transaction: the token change and its audit row use this client.
    mockTx: { session: {} as Record<string, unknown>, $queryRaw: undefined as unknown },
}));

vi.mock("@/lib/auth", () => ({ getCurrentContext: mockGetCurrentContext }));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));
vi.mock("next-auth/jwt", () => ({ getToken: mockGetToken }));
vi.mock("@/lib/db", () => ({
    prisma: {
        session: { create: mockSessionCreate, deleteMany: mockSessionDeleteMany },
        team: { findUnique: mockTeamFindUnique },
        $transaction: async (fn: (client: unknown) => unknown) => fn(mockTx),
    },
}));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAudit } }));

import { DELETE, POST } from "../route";

describe("POST /api/extension/token", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockTeamFindUnique.mockResolvedValue({ id: "team-a", name: "Acme Sales" });
        mockSessionDeleteMany.mockResolvedValue({ count: 0 });
        mockSessionCreate.mockResolvedValue({});
        mockAudit.mockResolvedValue(undefined);
        mockGetToken.mockResolvedValue({ sessionVersion: 2 });
        mockQueryRaw.mockResolvedValue([{ sessionVersion: 2, suspendedAt: null }]);
        mockTx.session = { create: mockSessionCreate, deleteMany: mockSessionDeleteMany };
        mockTx.$queryRaw = mockQueryRaw;
    });

    it("mints no token when the account was signed out since this browser signed in", async () => {
        mockQueryRaw.mockResolvedValue([{ sessionVersion: 3, suspendedAt: null }]);

        const res = await POST();

        expect(res.status).toBe(401);
        expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("mints no token for a suspended account", async () => {
        mockQueryRaw.mockResolvedValue([{ sessionVersion: 2, suspendedAt: new Date() }]);

        expect((await POST()).status).toBe(401);
        expect(mockSessionCreate).not.toHaveBeenCalled();
    });

    it("counts a sign-in from before session versions existed as version 0", async () => {
        mockGetToken.mockResolvedValue({});
        mockQueryRaw.mockResolvedValue([{ sessionVersion: 0, suspendedAt: null }]);

        expect((await POST()).status).toBe(200);
        expect(mockSessionCreate).toHaveBeenCalled();
    });

    it("garbage-collects this user's expired tokens before minting a new one", async () => {
        await POST();

        expect(mockSessionDeleteMany).toHaveBeenCalledWith({
            where: { userId: "user-1", expires: { lt: expect.any(Date) } },
        });
        // The cleanup must happen before the new row is created, not after.
        expect(mockSessionDeleteMany.mock.invocationCallOrder[0]).toBeLessThan(
            mockSessionCreate.mock.invocationCallOrder[0]
        );
    });

    it("ties the token to the team the user is in, and says which team", async () => {
        const body = await (await POST()).json();

        expect(mockSessionCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({ userId: "user-1", teamId: "team-a" }),
        });
        expect(body.team).toEqual({ id: "team-a", name: "Acme Sales" });
    });

    it("rejects when there's no authenticated user", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: null });

        const res = await POST();

        expect(res.status).toBe(401);
        expect(mockSessionCreate).not.toHaveBeenCalled();
    });
});

describe("extension token audit trail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetToken.mockResolvedValue({ sessionVersion: 2 });
        mockQueryRaw.mockResolvedValue([{ sessionVersion: 2, suspendedAt: null }]);
        mockTx.$queryRaw = mockQueryRaw;
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-a" });
        mockTeamFindUnique.mockResolvedValue({ id: "team-a", name: "Acme Sales" });
        mockSessionDeleteMany.mockResolvedValue({ count: 2 });
        mockSessionCreate.mockResolvedValue({});
        mockAudit.mockResolvedValue(undefined);
        mockTx.session = { create: mockSessionCreate, deleteMany: mockSessionDeleteMany };
    });

    it("records minting a token, strictly and on the transaction client, without the token", async () => {
        const body = await (await POST()).json();

        expect(mockAudit).toHaveBeenCalledWith(
            "team-a", "user-1", "extension_token_minted", "Session", null,
            {}, null, null, true, mockTx
        );
        expect(JSON.stringify(mockAudit.mock.calls)).not.toContain(body.token);
    });

    it("fails the mint when its audit row cannot be written", async () => {
        mockAudit.mockRejectedValue(new Error("audit table unavailable"));

        await expect(POST()).rejects.toThrow("audit table unavailable");
    });

    it("records revoking every token, with how many, on the transaction client", async () => {
        const res = await DELETE();

        expect(res.status).toBe(200);
        expect(mockSessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
        expect(mockAudit).toHaveBeenCalledWith(
            "team-a", "user-1", "extension_tokens_revoked", "Session", null,
            { revoked: 2 }, null, null, true, mockTx
        );
    });

    it("still mints and revokes for a user with no team, which has no workspace to record under", async () => {
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: null });

        expect((await POST()).status).toBe(200);
        expect((await DELETE()).status).toBe(200);
        expect(mockAudit).not.toHaveBeenCalled();
    });
});
