import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetServerSession, mockPrisma, mockAudit } = vi.hoisted(() => {
    const user = { findUnique: vi.fn(), update: vi.fn() };
    const teamMember = { updateMany: vi.fn() };
    // What the route sees inside prisma.$transaction: audited changes go through this client.
    const tx = { user, teamMember };
    return {
        mockGetServerSession: vi.fn(),
        mockAudit: vi.fn(),
        mockPrisma: {
            user,
            teamMember,
            tx,
            $transaction: vi.fn(async (fn: (client: unknown) => unknown) => fn(tx)),
        },
    };
});

vi.mock("next-auth", () => ({ getServerSession: mockGetServerSession }));
vi.mock("@/lib/auth", () => ({
    authOptions: {},
    canManageUsers: (role: string) => role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN" || role === "ORG_ADMIN",
    isSuperAdminRole: (role: string) => role === "SUPER_ADMIN" || role === "SYSTEM_ADMIN",
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/modules/audit/auditService", () => ({ AuditService: { log: mockAudit } }));

import { PATCH } from "./route";

function patchRequest(body: unknown) {
    return new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify(body),
    }) as any;
}

function actAs(enterpriseRole: string, targetRole = "user") {
    mockGetServerSession.mockResolvedValue({ user: { id: "actor" } });
    mockPrisma.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === "actor") {
            return { id: "actor", enterpriseRole, memberships: [{ teamId: "t1", status: "active" }] };
        }
        return { id: "target", email: "t@example.com", role: targetRole, enterpriseRole: "SALES_USER", memberships: [{ teamId: "t1", status: "active" }] };
    });
    mockPrisma.user.update.mockImplementation(async ({ data }: { data: object }) => ({ id: "target", ...data }));
}

describe("PATCH /api/admin/users - legacy role", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(mockPrisma.tx));
    });

    it.each(["admin", "superadmin"])("rejects an ORG_ADMIN granting legacy role %s", async (role) => {
        actAs("ORG_ADMIN");
        const res = await PATCH(patchRequest({ id: "target", role }));
        expect(res.status).toBe(403);
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects an ORG_ADMIN granting themselves legacy admin", async () => {
        actAs("ORG_ADMIN");
        const res = await PATCH(patchRequest({ id: "actor", role: "admin" }));
        expect(res.status).toBe(403);
        expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it("still lets an ORG_ADMIN set legacy role user", async () => {
        actAs("ORG_ADMIN");
        const res = await PATCH(patchRequest({ id: "target", role: "user" }));
        expect(res.status).toBe(200);
        expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { role: "user" } }));
    });

    it("lets an ORG_ADMIN resave a user whose legacy role is already admin", async () => {
        actAs("ORG_ADMIN", "admin");
        const res = await PATCH(patchRequest({ id: "target", role: "admin", enterpriseRole: "SALES_USER" }));
        expect(res.status).toBe(200);
    });

    it("lets a SUPER_ADMIN grant legacy role admin", async () => {
        actAs("SUPER_ADMIN");
        const res = await PATCH(patchRequest({ id: "target", role: "admin" }));
        expect(res.status).toBe(200);
        expect(mockPrisma.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: { role: "admin" } }));
    });
});

describe("PATCH /api/admin/users - audit trail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation(async (fn: (client: unknown) => unknown) => fn(mockPrisma.tx));
        mockAudit.mockResolvedValue(undefined);
    });

    it("writes a role change's audit row, strictly, on the transaction client of the update", async () => {
        actAs("SUPER_ADMIN");

        const res = await PATCH(patchRequest({ id: "target", enterpriseRole: "ORG_ADMIN" }));

        expect(res.status).toBe(200);
        expect(mockAudit).toHaveBeenCalledWith(
            "t1", "actor", "role_changed", "User", "target",
            { role: undefined, enterpriseRole: "ORG_ADMIN" },
            null, null, true, mockPrisma.tx
        );
    });

    it("fails the role change when its audit row cannot be written", async () => {
        actAs("SUPER_ADMIN");
        mockAudit.mockRejectedValue(new Error("audit table unavailable"));

        await expect(PATCH(patchRequest({ id: "target", enterpriseRole: "ORG_ADMIN" }))).rejects.toThrow("audit table unavailable");
    });

    it("deactivates a user and writes the audit row on one transaction client", async () => {
        actAs("SUPER_ADMIN");

        const res = await PATCH(patchRequest({ id: "target", status: "inactive" }));

        expect(res.status).toBe(200);
        expect(mockPrisma.tx.teamMember.updateMany).toHaveBeenCalled();
        expect(mockAudit).toHaveBeenCalledWith(
            "t1", "actor", "user_deactivated", "User", "target",
            { email: "t@example.com" },
            null, null, true, mockPrisma.tx
        );
    });
});

