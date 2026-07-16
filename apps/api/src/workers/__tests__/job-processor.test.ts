import { describe, expect, it, vi, beforeEach, Mock } from "vitest";
import { worker } from "../job-processor";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { handleGmailHistorySync } from "../handlers/gmail-history-sync-worker";
import { executeCampaign } from "../handlers/campaign-worker";

vi.mock("@/lib/db", () => ({
    prisma: {
        job: {
            findUnique: vi.fn(),
        },
    },
}));

vi.mock("@/lib/queue", () => ({
    JobQueue: {
        complete: vi.fn(),
        fail: vi.fn(),
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
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "123",
            },
        };
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(mockJob);
        (handleGmailHistorySync as Mock).mockResolvedValueOnce({
            mailboxId: "m1",
            synced: 10,
        });

        const result = await worker.performJob("job-1");

        expect(handleGmailHistorySync).toHaveBeenCalledWith(mockJob.payload);
        expect(JobQueue.complete).toHaveBeenCalledWith("job-1", {
            mailboxId: "m1",
            synced: 10,
        });
        expect(result).toEqual({ mailboxId: "m1", synced: 10 });
    });

    it("should propagate handler failure and call JobQueue.fail", async () => {
        const mockJob = {
            id: "job-1",
            type: "INBOX_SYNC",
            payload: {
                teamId: "t1",
                mailboxId: "m1",
                notificationHistoryId: "123",
            },
        };
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(mockJob);
        const syncError = new Error("Sync failed");
        (handleGmailHistorySync as Mock).mockRejectedValueOnce(syncError);

        await expect(worker.performJob("job-1")).rejects.toThrow("Sync failed");

        expect(JobQueue.fail).toHaveBeenCalledWith("job-1", "Sync failed");
    });

    it("should retain existing behavior for other job types (e.g. campaign_execution)", async () => {
        const mockJob = {
            id: "job-2",
            type: "campaign_execution",
            payload: {
                campaignId: "c1",
                userId: "u1",
            },
        };
        (prisma.job.findUnique as Mock).mockResolvedValueOnce(mockJob);
        (executeCampaign as Mock).mockResolvedValueOnce({
            campaignId: "c1",
            leadsProcessed: 5,
        });

        const result = await worker.performJob("job-2");

        expect(executeCampaign).toHaveBeenCalledWith("c1", "u1");
        expect(JobQueue.complete).toHaveBeenCalledWith("job-2", {
            campaignId: "c1",
            leadsProcessed: 5,
        });
        expect(result).toEqual({ campaignId: "c1", leadsProcessed: 5 });
    });
});
