import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, prisma } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    prisma: {
        user: { findUnique: vi.fn(), update: vi.fn() },
        superAdminAuditLog: { create: vi.fn() },
    },
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/superadmin/apiClient", () => ({ fetchSuperAdminUserDetail: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma }));

import { PATCH } from "../../src/app/api/superadmin/users/[id]/route";

const actor = { id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN", superAdminCredential: { id: "c" } };
const target = { id: "u-9", email: "user@example.com", enterpriseRole: "SALES_USER", suspendedAt: null };
const patch = (id: string, body: unknown) =>
    PATCH(new Request(`http://localhost/api/superadmin/users/${id}`, { method: "PATCH", body: JSON.stringify(body) }) as any, {
        params: Promise.resolve({ id }),
    });

describe("PATCH /api/superadmin/users/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        prisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id === "sa-1" ? actor : target));
    });

    it("needs a superadmin session", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await patch("u-9", { action: "signOut" })).status).toBe(401);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("suspends with a reason and ends the user's sessions", async () => {
        expect((await patch("u-9", { action: "suspend" })).status).toBe(400);
        const res = await patch("u-9", { action: "suspend", reason: "chargeback fraud" });
        expect(res.status).toBe(200);
        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: "u-9" },
            data: { suspendedAt: expect.any(Date), suspendedReason: "chargeback fraud", sessionVersion: { increment: 1 } },
        });
        expect(prisma.superAdminAuditLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ action: "USER_SUSPEND", metadata: { targetUserId: "u-9", email: "user@example.com", reason: "chargeback fraud" } }) })
        );
    });

    it("reactivates, signs out everywhere, and changes the role", async () => {
        await patch("u-9", { action: "reactivate" });
        expect(prisma.user.update).toHaveBeenLastCalledWith({ where: { id: "u-9" }, data: { suspendedAt: null, suspendedReason: null } });
        await patch("u-9", { action: "signOut" });
        expect(prisma.user.update).toHaveBeenLastCalledWith({ where: { id: "u-9" }, data: { sessionVersion: { increment: 1 } } });
        await patch("u-9", { action: "setRole", enterpriseRole: "ORG_ADMIN" });
        expect(prisma.user.update).toHaveBeenLastCalledWith({ where: { id: "u-9" }, data: { enterpriseRole: "ORG_ADMIN" } });
        expect((await patch("u-9", { action: "setRole", enterpriseRole: "GOD" })).status).toBe(400);
    });

    it("won't suspend or re-role the signed-in superadmin, or touch an unknown user", async () => {
        expect((await patch("sa-1", { action: "suspend", reason: "x" })).status).toBe(400);
        expect((await patch("sa-1", { action: "setRole", enterpriseRole: "VIEWER" })).status).toBe(400);
        prisma.user.findUnique.mockImplementation(async ({ where }: any) => (where.id === "sa-1" ? actor : null));
        expect((await patch("u-404", { action: "signOut" })).status).toBe(404);
        expect((await patch("u-9", { action: "explode" })).status).toBe(400);
        expect(prisma.user.update).not.toHaveBeenCalled();
    });
});
