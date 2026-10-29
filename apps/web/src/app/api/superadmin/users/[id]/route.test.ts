import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockAudit } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn(), update: vi.fn() },
        session: { deleteMany: vi.fn() },
    },
    mockAudit: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId: vi.fn() }));
vi.mock("@/lib/superadmin/apiClient", () => ({ fetchSuperAdminUserDetail: vi.fn() }));
vi.mock("@/lib/superadmin/actor", () => ({
    getSuperAdminActor: vi.fn().mockResolvedValue({ id: "admin-1", email: "admin@example.com" }),
    auditSuperAdmin: mockAudit,
}));
vi.mock("@/lib/userAccess", () => ({ forgetUserAccess: vi.fn() }));

import { PATCH } from "./route";

function patch(body: unknown) {
    const req = new Request("http://localhost/api/superadmin/users/user-2", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
    return PATCH(req as never, { params: Promise.resolve({ id: "user-2" }) });
}

describe("PATCH /api/superadmin/users/[id] - session revocation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.user.findUnique.mockResolvedValue({ id: "user-2", email: "u@example.com", enterpriseRole: "VIEWER", suspendedAt: null });
        mockPrisma.user.update.mockResolvedValue({});
    });

    it("still writes the audit entry and reports an error when ending extension sessions fails", async () => {
        mockPrisma.session.deleteMany.mockRejectedValue(new Error("db down"));

        const res = await patch({ action: "signOut" });

        expect(res.status).toBe(500);
        expect(mockAudit).toHaveBeenCalledWith(
            expect.anything(),
            "USER_SIGN_OUT",
            expect.anything(),
            expect.objectContaining({ sessionRevokeFailed: true }),
        );
    });

    it("answers normally when the sessions are ended", async () => {
        mockPrisma.session.deleteMany.mockResolvedValue({ count: 1 });

        const res = await patch({ action: "signOut" });

        expect(res.status).toBe(200);
        expect(mockAudit).toHaveBeenCalledTimes(1);
    });
});
