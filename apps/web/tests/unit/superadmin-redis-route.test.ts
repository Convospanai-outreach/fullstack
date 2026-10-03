import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSuperAdminUserId, superAdminApi, findUnique, auditCreate } = vi.hoisted(() => ({
    getSuperAdminUserId: vi.fn(),
    superAdminApi: vi.fn(),
    findUnique: vi.fn(),
    auditCreate: vi.fn(),
}));

vi.mock("@/lib/superadmin/session", () => ({ getSuperAdminUserId }));
vi.mock("@/lib/superadmin/apiClient", () => ({ superAdminApi }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findUnique }, superAdminAuditLog: { create: auditCreate } } }));

import { GET, POST } from "../../src/app/api/superadmin/redis/route";

const actor = { id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN", superAdminCredential: { id: "c-1" } };
const post = (body: unknown) =>
    POST(new Request("http://localhost/api/superadmin/redis", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "203.0.113.9" } }) as any);

describe("/api/superadmin/redis", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue(actor);
        superAdminApi.mockResolvedValue({ status: 200, body: { state: "off" } });
    });

    it("needs a live superadmin session", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await GET()).status).toBe(401);
        findUnique.mockResolvedValue({ ...actor, superAdminCredential: null });
        getSuperAdminUserId.mockResolvedValue("sa-1");
        expect((await post({ enabled: false })).status).toBe(401);
        expect(superAdminApi).not.toHaveBeenCalled();
    });

    it("switches Redis and records who did it", async () => {
        const res = await post({ enabled: false });
        expect(res.status).toBe(200);
        expect(superAdminApi).toHaveBeenCalledWith({ id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN" }, "POST", "/admin/super/redis", { enabled: false });
        expect(auditCreate).toHaveBeenCalledWith({
            data: { userId: "sa-1", action: "REDIS_DISABLE", ipAddress: "203.0.113.9", metadata: { result: "off" } },
        });
    });

    it("rejects a non-boolean and skips the audit row when the API refuses", async () => {
        expect((await post({ enabled: 1 })).status).toBe(400);
        superAdminApi.mockResolvedValue({ status: 403, body: { error: "Forbidden" } });
        expect((await post({ enabled: true })).status).toBe(403);
        expect(auditCreate).not.toHaveBeenCalled();
    });
});
