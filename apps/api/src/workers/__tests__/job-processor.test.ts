import { describe, expect, it, vi, beforeEach, Mock } from "vitest";
import { worker } from "../job-processor";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { handleGmailHistorySync } from "../handlers/gmail-history-sync-worker";
import { executeCampaign } from "../handlers/campaign-worker";
import { GmailMailboxLeaseContendedError } from "@/modules/email-campaigner/service/googleMailboxService";

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findFirst: vi.fn(),
        },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobClaimLostError: class JobClaimLostError extends Error {},
    JobQueue: {
        complete: vi.fn(),
        fail: vi.fn(),
        defer: vi.fn(),
        assertClaim: vi.fn(),
    },
}));

vi.mock("../handlers/gmail-history-sync-worker", () => ({
    handleGmailHistorySync: vi.fn(),
}));

vi.mock("../handlers/campaign-worker", () => ({
    executeCampaign: vi.fn(),
}));

describe("job-processor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should dispatch INBOX_SYNC job to handleGmailHistorySync and complete successfully", async () => {
        const mockJob = {
            id: "job-1",
            status: "running",
            version: 2,
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "123",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({
            mailboxId: "m1",
            synced: 10,
        });

        const result = await worker.performJob({ jobId: "job-1", version: 2 });

        expect(prisma.job.findFirst).toHaveBeenCalledWith({
            where: { id: "job-1", status: "running", version: 2 },
        });
        expect(JobQueue.assertClaim).toHaveBeenCalledWith("job-1", 2);
        expect(handleGmailHistorySync).toHaveBeenCalledWith(mockJob.payload);
        expect(JobQueue.complete).toHaveBeenCalledWith("job-1", 2, {
            mailboxId: "m1",
            synced: 10,
        });
        expect(result).toEqual({ mailboxId: "m1", synced: 10 });
    });

    it("should propagate handler failure and call JobQueue.fail", async () => {
        const mockJob = {
            id: "job-1",
            status: "running",
            version: 2,
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "123",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        const syncError = new Error("Sync failed");
        (handleGmailHistorySync as Mock).mockRejectedValueOnce(syncError);

        await expect(worker.performJob({ jobId: "job-1", version: 2 })).rejects.toThrow("Sync failed");

        expect(JobQueue.fail).toHaveBeenCalledWith("job-1", 2, "Sync failed");
        expect(JobQueue.defer).not.toHaveBeenCalled();
    });

    it("defers lease contention without completing the job or consuming normal failure accounting", async () => {
        const mockJob = {
            id: "job-contended",
            status: "running",
            version: 4,
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "124",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockRejectedValueOnce(new GmailMailboxLeaseContendedError("m1"));
        (JobQueue.defer as Mock).mockResolvedValueOnce({ id: mockJob.id, status: "queued" });
        const before = Date.now();

        const result = await worker.performJob({ jobId: mockJob.id, version: 4 });

        const after = Date.now();
        expect(result).toEqual({ deferred: true, reason: "MAILBOX_LEASE_CONTENDED" });
        expect(JobQueue.complete).not.toHaveBeenCalled();
        expect(JobQueue.fail).not.toHaveBeenCalled();
        expect(JobQueue.defer).toHaveBeenCalledWith(mockJob.id, 4, {
            processAt: expect.any(Date),
            reason: "MAILBOX_LEASE_CONTENDED",
        });
        const processAt = (JobQueue.defer as Mock).mock.calls[0][2].processAt as Date;
        expect(processAt.getTime()).toBeGreaterThanOrEqual(before + 15_000);
        expect(processAt.getTime()).toBeLessThanOrEqual(after + 45_000);
    });

    it("should retain existing behavior for other job types (e.g. campaign_execution)", async () => {
        const mockJob = {
            id: "job-2",
            status: "running",
            version: 3,
            type: "campaign_execution",
            payload: {
                campaignId: "c1",
                userId: "u1",
            },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(mockJob);
        (executeCampaign as Mock).mockResolvedValueOnce({
            campaignId: "c1",
            leadsProcessed: 5,
        });

        const result = await worker.performJob({ jobId: "job-2", version: 3 });

        expect(executeCampaign).toHaveBeenCalledWith("c1", "u1");
        expect(JobQueue.complete).toHaveBeenCalledWith("job-2", 3, {
            campaignId: "c1",
            leadsProcessed: 5,
        });
        expect(result).toEqual({ campaignId: "c1", leadsProcessed: 5 });
    });

    it("never adopts a reloaded newer version when finalizing the original claim", async () => {
        const reloadedJob = {
            id: "job-1",
            status: "running",
            version: 99,
            type: "INBOX_SYNC",
            payload: { teamId: "t1", mailboxId: "m1", notificationHistoryId: "123" },
        };
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(reloadedJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({ synced: 1 });

        await worker.performJob({ jobId: "job-1", version: 2 });

        expect(JobQueue.assertClaim).toHaveBeenCalledWith("job-1", 2);
        expect(JobQueue.complete).toHaveBeenCalledWith("job-1", 2, { synced: 1 });
        expect(JobQueue.complete).not.toHaveBeenCalledWith("job-1", 99, expect.anything());
    });

    it("stops before the business handler when the original running claim is gone", async () => {
        (prisma.job.findFirst as Mock).mockResolvedValueOnce(null);

        await expect(worker.performJob({ jobId: "job-lost", version: 2 })).rejects.toBeInstanceOf(Error);

        expect(handleGmailHistorySync).not.toHaveBeenCalled();
        expect(JobQueue.complete).not.toHaveBeenCalled();
        expect(JobQueue.fail).not.toHaveBeenCalled();
        expect(JobQueue.defer).not.toHaveBeenCalled();
    });
});
