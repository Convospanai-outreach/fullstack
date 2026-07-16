import { vi, Mock, beforeEach, describe, it, expect } from "vitest";
import { JobQueue } from "../queue";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
            findUnique: vi.fn(),
            create: vi.fn()
        }
    }
}));

describe("JobQueue.dequeue", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("skips a candidate that loses the claim race and returns the next eligible job", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([
            { id: "job-1" },
            { id: "job-2" }
        ]);
        (prisma.job.updateMany as Mock)
            .mockResolvedValueOnce({ count: 0 })
            .mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValue({
            id: "job-2",
            status: "running"
        });

        const job = await JobQueue.dequeue();

        expect(job?.id).toBe("job-2");
        expect(prisma.job.updateMany).toHaveBeenCalledTimes(2);
        expect(prisma.job.findUnique).toHaveBeenCalledWith({
            where: { id: "job-2" }
        });
    });

    it("keeps legacy pending jobs claimable through the atomic guard", async () => {
        (prisma.job.findMany as Mock).mockResolvedValue([
            { id: "legacy-job" }
        ]);
        (prisma.job.updateMany as Mock).mockResolvedValueOnce({ count: 1 });
        (prisma.job.findUnique as Mock).mockResolvedValue({
            id: "legacy-job",
            status: "running"
        });

        const job = await JobQueue.dequeue();

        expect(job?.id).toBe("legacy-job");
        expect(prisma.job.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: "legacy-job",
                    status: { in: ["queued", "pending"] }
                })
            })
        );
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
