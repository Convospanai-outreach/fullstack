import { vi, Mock, beforeEach, describe, it, expect } from "vitest";
import {
    JOB_STATUS,
    JobClaimLostError,
    JobQueue,
    STALE_JOB_RECOVERY_MAX_CONCURRENT_WRITES,
    STALE_JOB_RECOVERY_PAGE_SIZE,
} from "../queue";
import { prisma } from "@/lib/db";
import { NotificationDispatcher } from "@/lib/notifications";

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn()
        }
    }
}));

vi.mock("@/lib/notifications", () => ({
    NotificationDispatcher: {
        send: vi.fn(),
    },
}));

describe("JobQueue.dequeue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("skips a candidate that loses the claim race and returns the next eligible job", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([
            { id: "job-1", version: 3 },
            { id: "job-2", version: 7 }
        ]);
        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });
        (prisma.job.findFirst as Mock).mockResolvedValue({
            id: "job-2",
            status: "running",
            version: 8,
        });

        const job = await JobQueue.dequeue();

        expect(job?.id).toBe("job-2");
        expect(prisma.job.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.job.findFirst).toHaveBeenCalledWith({
            where: { id: "job-2", status: "running", version: 8 }
        });
    });

    it("atomically claims a legacy null-version pending job as concrete version 1", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([
            { id: "legacy-job", version: null }
        ]);
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findFirst as Mock).mockResolvedValue({
            id: "legacy-job",
            status: "running",
            version: 1,
        });

        const job = await JobQueue.dequeue();

        expect(job?.id).toBe("legacy-job");
        expect(job?.version).toBe(1);
        expect(prisma.job.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "legacy-job",
                    status: { in: ["queued", "pending"] },
                    version: null,
                })
            })
        );
    });

    it("allows only one competing worker to claim a legacy null-version job", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([{ id: "legacy-job", version: null }]);
        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 1 })
            .mockResolvedValueOnce({ count: 0 });
        (prisma.job.findFirst as Mock).mockResolvedValue({
            id: "legacy-job",
            status: "running",
            version: 1,
        });

        const claims = await Promise.all([JobQueue.dequeue(), JobQueue.dequeue()]);

        expect(claims.filter(Boolean)).toHaveLength(1);
        for (const call of (prisma.job.updateMany as Mock).mock.calls) {
            expect(call[0].where).toEqual(expect.objectContaining({
                id: "legacy-job",
                version: null,
            }));
        }
    });

    it("uses only lowercase queue states and never silently adopts uppercase PENDING", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([]);

        await expect(JobQueue.dequeue()).resolves.toBeNull();

        expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ status: { in: ["queued", "pending"] } }),
        }));
        expect(JOB_STATUS.PENDING).toBe("pending");
        expect((prisma.job.findMany as Mock).mock.calls[0][0].where.status.in).not.toContain("PENDING");
    });
});

describe("JobQueue.enqueue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates a job when no idempotency key is provided", async () => {
        const mockJob = { id: "job-new", type: "INBOX_SYNC" };
        (prisma.job.create as Mock).mockResolvedValueOnce(mockJob);

        const result = await JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" });

        expect(result).toBe(mockJob);
        expect(prisma.job.create).toHaveBeenCalled();
        expect(prisma.job.findUnique).not.toHaveBeenCalled();
    });

    it("returns existing job if idempotency key exists (fast path)", async () => {
        const mockJob = { id: "job-existing", idempotencyKey: "key-123" };
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(mockJob);

        const result = await JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" }, { idempotencyKey: "key-123" });

        expect(result).toBe(mockJob);
        expect(prisma.job.findUnique).toHaveBeenCalledWith({
            where: { idempotencyKey: "key-123" }
        });
        expect(prisma.job.create).not.toHaveBeenCalled();
    });

    it("creates a job and handles concurrent P2002 targeting idempotencyKey by returning the winning job", async () => {
        // Fast path findUnique returns null (not found yet)
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(null);
        // Create throws P2002 targeting idempotencyKey
        const p2002Error = new Error("Unique constraint failed");
        (p2002Error as any).code = "P2002";
        (p2002Error as any).meta = { target: ["idempotencyKey"] };
        (prisma.job.create as Mock).mockRejectedValueOnce(p2002Error);
        // Secondary findUnique retrieves winning job
        const mockWinningJob = { id: "winning-job", idempotencyKey: "key-123" };
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(mockWinningJob);

        const result = await JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" }, { idempotencyKey: "key-123" });

        expect(result).toBe(mockWinningJob);
        expect(prisma.job.findUnique).toHaveBeenCalledTimes(2);
        expect(prisma.job.findUnique).toHaveBeenNthCalledWith(2, {
            where: { idempotencyKey: "key-123" }
        });
        expect(prisma.job.create).toHaveBeenCalled();
    });

    it("rethrows P2002 targeting another unique field", async () => {
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(null);
        const p2002Error = new Error("Unique constraint failed");
        (p2002Error as any).code = "P2002";
        (p2002Error as any).meta = { target: ["taskId"] };
        (prisma.job.create as Mock).mockRejectedValueOnce(p2002Error);

        await expect(
            JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" }, { idempotencyKey: "key-123" })
        ).rejects.toThrow("Unique constraint failed");

        // Should not perform secondary lookup
        expect(prisma.job.findUnique).toHaveBeenCalledTimes(1);
    });

    it("rethrows P2002 with missing target metadata", async () => {
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(null);
        const p2002Error = new Error("Unique constraint failed");
        (p2002Error as any).code = "P2002";
        (prisma.job.create as Mock).mockRejectedValueOnce(p2002Error);

        await expect(
            JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" }, { idempotencyKey: "key-123" })
        ).rejects.toThrow("Unique constraint failed");

        expect(prisma.job.findUnique).toHaveBeenCalledTimes(1);
    });

    it("rethrows P2002 targeting idempotencyKey when winning job cannot be retrieved (no winning row)", async () => {
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(null);
        const p2002Error = new Error("Unique constraint failed");
        (p2002Error as any).code = "P2002";
        (p2002Error as any).meta = { target: "Job_idempotencyKey_key" };
        (prisma.job.create as Mock).mockRejectedValueOnce(p2002Error);
        // Secondary findUnique returns null
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(null);

        await expect(
            JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" }, { idempotencyKey: "key-123" })
        ).rejects.toThrow("Unique constraint failed");

        expect(prisma.job.findUnique).toHaveBeenCalledTimes(2);
    });

    it("rethrows non-P2002 errors", async () => {
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(null);
        const otherError = new Error("Database offline");
        (prisma.job.create as Mock).mockRejectedValueOnce(otherError);

        await expect(
            JobQueue.enqueue("INBOX_SYNC", { mailboxId: "m1" }, { idempotencyKey: "key-123" })
        ).rejects.toThrow("Database offline");
    });
});

describe("JobQueue.defer", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("conditionally requeues a running job without consuming its claim attempt or replacing durable fields", async () => {
        const processAt = new Date("2026-07-16T12:00:30.000Z");
        const durableJob = {
            id: "job-1",
            status: "queued",
            attempts: 2,
            payload: { mailboxId: "mailbox-1", notificationHistoryId: "123" },
            idempotencyKey: "gmail:mailbox-1:123",
        };
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(durableJob);

        const result = await JobQueue.defer("job-1", 8, {
            processAt,
            reason: "MAILBOX_LEASE_CONTENDED",
        });

        expect(prisma.job.updateMany).toHaveBeenCalledWith({
            where: { id: "job-1", status: "running", version: 8, attempts: { gt: 0 } },
            data: {
                status: "queued",
                processAt,
                startedAt: null,
                error: "MAILBOX_LEASE_CONTENDED",
                attempts: { decrement: 1 },
            },
        });
        const data = (prisma.job.updateMany as Mock).mock.calls[0][0].data;
        expect(data).not.toHaveProperty("payload");
        expect(data).not.toHaveProperty("idempotencyKey");
        expect(result?.payload).toEqual(durableJob.payload);
        expect(result?.idempotencyKey).toBe(durableJob.idempotencyKey);
    });

    it("fails closed when the job is no longer the currently running claim", async () => {
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 0 });

        await expect(JobQueue.defer("job-1", 8, {
            processAt: new Date(),
            reason: "MAILBOX_LEASE_CONTENDED",
        })).rejects.toBeInstanceOf(JobClaimLostError);
        expect(prisma.job.findUnique).not.toHaveBeenCalled();
    });
});

describe("JobQueue.fail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("dispatches a SYSTEM notification to the job's owner on permanent failure", async () => {
        const runningJob = {
            id: "job-1",
            status: "running",
            type: "INBOX_SYNC",
            attempts: 3,
            maxAttempts: 3,
            payload: { userId: "user-1", mailboxId: "mailbox-1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(runningJob);
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValueOnce({ ...runningJob, status: "dead_lettered" });

        await JobQueue.fail("job-1", 3, "upstream timeout");

        expect(NotificationDispatcher.send).toHaveBeenCalledWith(
            "user-1",
            "SYSTEM",
            "Job Failed",
            "Job INBOX_SYNC permanently failed after 3 attempts",
            { jobId: "job-1", error: "upstream timeout" }
        );
    });

    it("does not dispatch a notification when the job payload has no userId", async () => {
        const runningJob = {
            id: "job-2",
            status: "running",
            type: "INBOX_SYNC",
            attempts: 3,
            maxAttempts: 3,
            payload: { mailboxId: "mailbox-1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(runningJob);
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValueOnce({ ...runningJob, status: "dead_lettered" });

        await JobQueue.fail("job-2", 3, "upstream timeout");

        expect(NotificationDispatcher.send).not.toHaveBeenCalled();
    });

    it("schedules a retry (and does not dispatch a notification) when attempts remain", async () => {
        const runningJob = {
            id: "job-3",
            status: "running",
            type: "INBOX_SYNC",
            attempts: 1,
            maxAttempts: 3,
            payload: { userId: "user-1" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(runningJob);
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValueOnce({ ...runningJob, status: "queued" });

        await JobQueue.fail("job-3", 3, "transient error");

        expect(NotificationDispatcher.send).not.toHaveBeenCalled();
    });
});

describe("JobQueue claim handoff fencing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("invalidates a stale claim, allows a replacement claim, and rejects stale complete, fail, and defer", async () => {
        const staleStartedAt = new Date("2026-07-16T12:00:00.000Z");
        (prisma.job.findMany as Mock)
            .mockResolvedValueOnce([{ id: "job-1", status: "running", version: 1, startedAt: staleStartedAt }])
            .mockResolvedValueOnce([{ id: "job-1", status: "queued", version: 2 }]);
        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 1 }) // watchdog v1 -> v2
            .mockResolvedValueOnce({ count: 1 }); // replacement claim v2 -> v3
        (prisma.job.findFirst as Mock)
            .mockResolvedValueOnce({ id: "job-1", status: "running", version: 3 })
            .mockResolvedValueOnce({ id: "job-1", status: "running", version: 1, attempts: 1, maxAttempts: 3 });

        await expect(JobQueue.resetStaleJobs(1)).resolves.toBe(1);
        expect(prisma.job.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({ id: "job-1", status: "running", version: 1 }),
            data: expect.objectContaining({ status: "queued", version: 2, startedAt: null }),
        }));

        const replacement = await JobQueue.dequeue();
        expect(replacement).toMatchObject({ id: "job-1", status: "running", version: 3 });

        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 0 }) // stale complete v1
            .mockResolvedValueOnce({ count: 0 }) // stale fail v1
            .mockResolvedValueOnce({ count: 0 }); // stale defer v1

        await expect(JobQueue.complete("job-1", 1, {})).rejects.toBeInstanceOf(JobClaimLostError);
        await expect(JobQueue.fail("job-1", 1, "stale worker")).rejects.toBeInstanceOf(JobClaimLostError);
        await expect(JobQueue.defer("job-1", 1, {
            processAt: new Date(),
            reason: "MAILBOX_LEASE_CONTENDED",
        })).rejects.toBeInstanceOf(JobClaimLostError);

        expect(prisma.job.updateMany).toHaveBeenNthCalledWith(3, expect.objectContaining({
            where: expect.objectContaining({ id: "job-1", status: "running", version: 1 }),
        }));
        expect(prisma.job.updateMany).toHaveBeenNthCalledWith(4, expect.objectContaining({
            where: expect.objectContaining({ id: "job-1", status: "running", version: 1 }),
        }));
        expect(prisma.job.updateMany).toHaveBeenNthCalledWith(5, expect.objectContaining({
            where: expect.objectContaining({ id: "job-1", status: "running", version: 1 }),
        }));
    });

    it("allows the current replacement claim to complete normally", async () => {
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValueOnce({ id: "job-1", status: "succeeded", version: 3 });

        await expect(JobQueue.complete("job-1", 3, { ok: true })).resolves.toMatchObject({
            status: "succeeded",
            version: 3,
        });
    });
});

describe("JobQueue.resetStaleJobs", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("recovers a stale backlog in bounded pages", async () => {
        const firstPage = Array.from({ length: STALE_JOB_RECOVERY_PAGE_SIZE }, (_, index) => ({
            id: `job-${String(index).padStart(4, "0")}`,
            status: JOB_STATUS.RUNNING,
            version: 1,
        }));
        const finalPage = [{ id: "job-9999", status: JOB_STATUS.PROCESSING, version: 4 }];
        (prisma.job.findMany as Mock)
            .mockResolvedValueOnce(firstPage)
            .mockResolvedValueOnce(finalPage);
        (prisma.job.updateMany as Mock).mockResolvedValue({ count: 1 });

        await expect(JobQueue.resetStaleJobs(60_000)).resolves.toBe(STALE_JOB_RECOVERY_PAGE_SIZE + 1);

        expect(prisma.job.findMany).toHaveBeenCalledTimes(2);
        expect((prisma.job.findMany as Mock).mock.calls[1][0].where).toEqual(expect.objectContaining({
            id: { gt: firstPage.at(-1)?.id },
        }));
        expect(prisma.job.updateMany).toHaveBeenCalledTimes(STALE_JOB_RECOVERY_PAGE_SIZE + 1);
    });

    it("keeps version and status guards and counts only successfully reset claims", async () => {
        (prisma.job.findMany as Mock).mockResolvedValueOnce([
            { id: "running-claim", status: JOB_STATUS.RUNNING, version: 3 },
            { id: "processing-claim", status: JOB_STATUS.PROCESSING, version: 9 },
        ]);
        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });

        await expect(JobQueue.resetStaleJobs(60_000)).resolves.toBe(1);

        expect(prisma.job.updateMany).toHaveBeenNthCalledWith(1, expect.objectContaining({
            where: expect.objectContaining({ id: "running-claim", status: JOB_STATUS.RUNNING, version: 3 }),
            data: expect.objectContaining({ version: 4 }),
        }));
        expect(prisma.job.updateMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
            where: expect.objectContaining({ id: "processing-claim", status: JOB_STATUS.PROCESSING, version: 9 }),
            data: expect.objectContaining({ version: 10 }),
        }));
    });

    it("only selects stale running and processing claims", async () => {
        (prisma.job.findMany as Mock).mockResolvedValueOnce([]);

        await expect(JobQueue.resetStaleJobs(60_000)).resolves.toBe(0);

        const where = (prisma.job.findMany as Mock).mock.calls[0][0].where;
        expect(where.status).toEqual({ in: [JOB_STATUS.RUNNING, JOB_STATUS.PROCESSING] });
        expect(where.startedAt).toEqual({ lte: expect.any(Date) });
        expect(where.status.in).not.toEqual(expect.arrayContaining(["queued", "completed", "failed", "cancelled"]));
    });

    it("limits concurrent stale-claim update writes", async () => {
        const jobs = Array.from({ length: STALE_JOB_RECOVERY_MAX_CONCURRENT_WRITES * 2 + 1 }, (_, index) => ({
            id: `job-${index}`,
            status: JOB_STATUS.RUNNING,
            version: 1,
        }));
        (prisma.job.findMany as Mock).mockResolvedValueOnce(jobs);
        let activeWrites = 0;
        let maximumActiveWrites = 0;
        (prisma.job.updateMany as Mock).mockImplementation(async () => {
            activeWrites++;
            maximumActiveWrites = Math.max(maximumActiveWrites, activeWrites);
            await new Promise((resolve) => setTimeout(resolve, 1));
            activeWrites--;
            return { count: 1 };
        });

        await expect(JobQueue.resetStaleJobs(60_000)).resolves.toBe(jobs.length);

        expect(maximumActiveWrites).toBeLessThanOrEqual(STALE_JOB_RECOVERY_MAX_CONCURRENT_WRITES);
        expect(maximumActiveWrites).toBeGreaterThan(1);
    });
});
