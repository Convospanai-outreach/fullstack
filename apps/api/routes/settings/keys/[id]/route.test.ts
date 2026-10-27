import { beforeEach, describe, expect, it, vi } from "vitest";

const {
    mockWriteAuditLog,
    mockDispatchAuditWebhook,
    mockCheckTeamPermission,
    mockGetCurrentContext,
    mockPrisma,
    mockTx,
} = vi.hoisted(() => {
    // What the route sees inside prisma.$transaction: only this client may be used there.
    const tx = { apiKey: { updateMany: vi.fn() } };
    return {
        mockWriteAuditLog: vi.fn(),
        mockDispatchAuditWebhook: vi.fn(),
        mockCheckTeamPermission: vi.fn(),
        mockGetCurrentContext: vi.fn(),
        mockTx: tx,
        mockPrisma: {
            apiKey: { findFirst: vi.fn() },
            $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
        },
    };
});

vi.mock("@/lib/auth", () => ({
    getCurrentContext: mockGetCurrentContext,
}));

vi.mock("@/lib/db", () => ({
    prisma: mockPrisma,
}));

vi.mock("@/lib/permissions", () => ({
    TeamRole: { ADMIN: "admin" },
    checkTeamPermission: mockCheckTeamPermission,
}));

vi.mock("@/lib/governance/audit", () => ({
    writeAuditLog: mockWriteAuditLog,
    dispatchAuditWebhook: mockDispatchAuditWebhook,
}));

describe("/settings/keys/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetCurrentContext.mockResolvedValue({ userId: "user-1", teamId: "team-1" });
        mockCheckTeamPermission.mockResolvedValue(true);
        mockWriteAuditLog.mockResolvedValue({ id: "log-1", createdAt: new Date() });
        mockDispatchAuditWebhook.mockResolvedValue(undefined);
        mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(mockTx));
        mockPrisma.apiKey.findFirst.mockResolvedValue({ id: "key-1", isActive: true });
        mockTx.apiKey.updateMany.mockResolvedValue({ count: 1 });
    });

    it("revokes active keys without deleting the record", async () => {
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-1", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-1" }) });

        expect(response.status).toBe(200);
        expect(mockTx.apiKey.updateMany).toHaveBeenCalledWith({
            where: { id: "key-1", teamId: "team-1", isActive: true },
            data: { isActive: false },
        });
        // The audit row is written on the same transaction client as the revoke, then announced.
        expect(mockWriteAuditLog).toHaveBeenCalledWith(mockTx, expect.objectContaining({
            action: "API_KEY_REVOKED",
            entityId: "key-1",
            metadata: {},
        }));
        expect(mockDispatchAuditWebhook).toHaveBeenCalledTimes(1);
    });

    it("fails the revoke, and announces nothing, when the audit row cannot be written", async () => {
        mockWriteAuditLog.mockRejectedValue(new Error("audit table unavailable"));
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-1", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-1" }) });

        // The error propagates out of the transaction callback, which is what rolls the revoke back.
        expect(response.status).toBeGreaterThanOrEqual(500);
        expect(mockDispatchAuditWebhook).not.toHaveBeenCalled();
    });

    it("returns 404 and writes no audit row when the key was revoked by someone else first", async () => {
        mockTx.apiKey.updateMany.mockResolvedValue({ count: 0 });
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-1", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-1" }) });

        expect(response.status).toBe(404);
        expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it("returns 404 when no active team-scoped key is revoked", async () => {
        mockPrisma.apiKey.findFirst.mockResolvedValue(null);
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-2", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-2" }) });

        expect(response.status).toBe(404);
        expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });

    it("returns success for repeated revocation of an inactive same-team key", async () => {
        mockPrisma.apiKey.findFirst.mockResolvedValue({ id: "key-1", isActive: false });
        const { DELETE } = await import("./route");

        const response = await DELETE(new Request("http://localhost/settings/keys/key-1", {
            method: "DELETE",
        }) as any, { params: Promise.resolve({ id: "key-1" }) });

        expect(response.status).toBe(200);
        expect(mockTx.apiKey.updateMany).not.toHaveBeenCalled();
        expect(mockWriteAuditLog).not.toHaveBeenCalled();
    });
});
