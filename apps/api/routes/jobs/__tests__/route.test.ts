import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockPrisma, mockAuth, mockQueue } = vi.hoisted(() => ({
    mockPrisma: {
        job: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            update: vi.fn(),
        },
    },
    mockAuth: {
        getCurrentContext: vi.fn(),
    },
    mockQueue: {
        JobQueue: {
            enqueue: vi.fn(),
        },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ getCurrentContext: mockAuth.getCurrentContext }));
vi.mock("@/lib/queue", () => ({ JobQueue: mockQueue.JobQueue }));

describe("/api/jobs route handlers (SEC-02)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("GET /api/jobs", () => {
        it("returns 401 if unauthenticated", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { GET } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs");
            const res = await GET(req);

            expect(res.status).toBe(401);
            expect(mockPrisma.job.findMany).not.toHaveBeenCalled();
        });

        it("scopes findMany to current teamId", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            mockPrisma.job.findMany.mockResolvedValue([{ id: "j1", teamId: "team-alpha" }]);

            const { GET } = await import("../route");
            const req = new NextRequest("http://localhost/api/jobs?type=email_send");
            const res = await GET(req);

            expect(res.status).toBe(200);
            expect(mockPrisma.job.findMany).toHaveBeenCalledWith({
                where: {
                    teamId: "team-alpha",
                    type: "email_send",
                },
                take: 50,
                skip: 0,
                orderBy: { createdAt: "desc" },
            });
        });
    });

    describe("POST /api/jobs", () => {
        it("returns 401 if unauthenticated", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs", {
                method: "POST",
                body: JSON.stringify({ type: "lead_scoring", payload: { leadId: "l1" } }),
            });
            const res = await POST(req);

            expect(res.status).toBe(401);
            expect(mockQueue.JobQueue.enqueue).not.toHaveBeenCalled();
        });

        it("enforces session teamId when enqueuing job", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            mockQueue.JobQueue.enqueue.mockResolvedValue({ id: "j-created" });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs", {
                method: "POST",
                body: JSON.stringify({ type: "lead_scoring", payload: { leadId: "l1" }, teamId: "attacker-team" }),
            });
            const res = await POST(req);

            expect(res.status).toBe(201);
            expect(mockQueue.JobQueue.enqueue).toHaveBeenCalledWith(
                "lead_scoring",
                { leadId: "l1", teamId: "team-alpha" },
                expect.objectContaining({ teamId: "team-alpha" })
            );
        });

        it("rejects warmup_seed_reply as a client-enqueueable job type (legacy shape)", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs", {
                method: "POST",
                body: JSON.stringify({
                    type: "warmup_seed_reply",
                    payload: { seedMailboxId: "seed-1", toEmail: "victim@external.com", subject: "hijacked" },
                }),
            });
            const res = await POST(req);

            expect(res.status).toBe(403);
            expect(mockQueue.JobQueue.enqueue).not.toHaveBeenCalled();
        });

        it("rejects warmup_seed_reply as a client-enqueueable job type (envelope shape)", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs", {
                method: "POST",
                body: JSON.stringify({
                    version: 1,
                    task_type: "warmup_seed_reply",
                    tenant_id: "team-alpha",
                    execution_mode: "saas_only",
                    target_runtime: "saas_only",
                    task_id: "task-1",
                    idempotency_key: "idem-1",
                    created_at: new Date().toISOString(),
                    payload: { seedMailboxId: "seed-1", toEmail: "victim@external.com", subject: "hijacked" },
                }),
            });
            const res = await POST(req);

            expect(res.status).toBe(403);
            expect(mockQueue.JobQueue.enqueue).not.toHaveBeenCalled();
        });

        it("rejects workflow_step as a client-enqueueable job type (cross-tenant workflow-run hijack)", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs", {
                method: "POST",
                body: JSON.stringify({
                    type: "workflow_step",
                    payload: { runId: "victim-team-run-1", nodeId: "email-node-1" },
                }),
            });
            const res = await POST(req);

            expect(res.status).toBe(403);
            expect(mockQueue.JobQueue.enqueue).not.toHaveBeenCalled();
        });

        it("overrides an attacker-supplied payload.teamId with the caller's own session teamId", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            mockQueue.JobQueue.enqueue.mockResolvedValue({ id: "j-created" });
            const { POST } = await import("../route");

            const req = new NextRequest("http://localhost/api/jobs", {
                method: "POST",
                body: JSON.stringify({
                    type: "email_sending",
                    payload: { leadId: "l1", campaignId: "c1", teamId: "victim-team" },
                    idempotencyKey: "idem-1",
                }),
            });
            const res = await POST(req);

            expect(res.status).toBe(201);
            expect(mockQueue.JobQueue.enqueue).toHaveBeenCalledWith(
                "email_sending",
                { leadId: "l1", campaignId: "c1", teamId: "team-alpha" },
                expect.objectContaining({ teamId: "team-alpha" })
            );
        });
    });

    describe("GET /api/jobs/[id]", () => {
        it("returns 401 if unauthenticated", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: null, teamId: null });
            const { GET } = await import("../[id]/route");

            const req = new NextRequest("http://localhost/api/jobs/j1");
            const res = await GET(req, { params: Promise.resolve({ id: "j1" }) });

            expect(res.status).toBe(401);
        });

        it("returns 404 if job belongs to another team (IDOR protection)", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            mockPrisma.job.findFirst.mockResolvedValue(null);

            const { GET } = await import("../[id]/route");
            const req = new NextRequest("http://localhost/api/jobs/j-foreign");
            const res = await GET(req, { params: Promise.resolve({ id: "j-foreign" }) });

            expect(res.status).toBe(404);
            expect(mockPrisma.job.findFirst).toHaveBeenCalledWith({
                where: { id: "j-foreign", teamId: "team-alpha" },
            });
        });
    });

    describe("DELETE /api/jobs/[id]", () => {
        it("returns 404 if job does not belong to team", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            mockPrisma.job.findFirst.mockResolvedValue(null);

            const { DELETE } = await import("../[id]/route");
            const req = new NextRequest("http://localhost/api/jobs/j-foreign", { method: "DELETE" });
            const res = await DELETE(req, { params: Promise.resolve({ id: "j-foreign" }) });

            expect(res.status).toBe(404);
            expect(mockPrisma.job.update).not.toHaveBeenCalled();
        });
    });

    describe("POST /api/jobs/[id]/retry", () => {
        it("returns 404 if job does not belong to team", async () => {
            mockAuth.getCurrentContext.mockResolvedValue({ userId: "u1", teamId: "team-alpha" });
            mockPrisma.job.findFirst.mockResolvedValue(null);

            const { POST } = await import("../[id]/retry/route");
            const req = new NextRequest("http://localhost/api/jobs/j-foreign/retry", { method: "POST" });
            const res = await POST(req, { params: Promise.resolve({ id: "j-foreign" }) });

            expect(res.status).toBe(404);
            expect(mockPrisma.job.update).not.toHaveBeenCalled();
        });
    });
});
