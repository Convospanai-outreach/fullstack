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

import { POST } from "../../src/app/api/superadmin/jobs/[id]/replay/route";

const replay = (id: string) =>
    POST(new Request(`http://localhost/api/superadmin/jobs/${id}/replay`, { method: "POST" }) as any, { params: Promise.resolve({ id }) });

describe("POST /api/superadmin/jobs/[id]/replay", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getSuperAdminUserId.mockResolvedValue("sa-1");
        findUnique.mockResolvedValue({ id: "sa-1", email: "ops@example.com", enterpriseRole: "SYSTEM_ADMIN", superAdminCredential: { id: "c" } });
    });

    it("needs a superadmin session", async () => {
        getSuperAdminUserId.mockResolvedValue(null);
        expect((await replay("job-1")).status).toBe(401);
        expect(superAdminApi).not.toHaveBeenCalled();
    });

    it("requeues the job, audits it, and returns no payload", async () => {
        superAdminApi.mockResolvedValue({ status: 200, body: { id: "job-1", type: "CRM_SYNC", status: "queued", payload: { email: "lead@example.com" } } });
        const res = await replay("job-1");
        expect(superAdminApi).toHaveBeenCalledWith(expect.objectContaining({ id: "sa-1" }), "POST", "/admin/jobs/replay/job-1");
        expect(await res.json()).toEqual({ id: "job-1", type: "CRM_SYNC", status: "queued" });
        expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "JOB_REPLAY", metadata: { jobId: "job-1", type: "CRM_SYNC" } }) }));
    });

    it("passes an API refusal through without auditing", async () => {
        superAdminApi.mockResolvedValue({ status: 400, body: { error: "Only dead letter jobs can be replayed" } });
        const res = await replay("job-2");
        expect(res.status).toBe(400);
        expect(auditCreate).not.toHaveBeenCalled();
    });
});
