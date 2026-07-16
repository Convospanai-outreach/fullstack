import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { JobQueue } from "@/lib/queue";
import { worker } from "../job-processor";
import { WorkerManager } from "../worker-manager";

vi.mock("@/lib/queue", () => ({
    JobClaimLostError: class JobClaimLostError extends Error {},
    JobQueue: {
        dequeue: vi.fn(),
        resetStaleJobs: vi.fn().mockResolvedValue(0),
    },
}));

vi.mock("@/modules/scheduler/schedulerService", () => ({
    schedulerService: { processDueSchedules: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../job-processor", () => ({
    worker: { performJob: vi.fn().mockResolvedValue(undefined) },
}));

describe("WorkerManager claim propagation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the exact concrete dequeue version to executeJob", async () => {
        const manager = new WorkerManager();
        const executeJob = vi.spyOn(manager as any, "executeJob").mockResolvedValue(undefined);
        vi.spyOn(manager as any, "handleMaintenanceTick").mockResolvedValue(undefined);
        (JobQueue.dequeue as Mock).mockImplementationOnce(async () => {
            queueMicrotask(() => void manager.stop());
            return { id: "job-1", version: 7 };
        });

        await manager.start();

        expect(executeJob).toHaveBeenCalledWith({ jobId: "job-1", version: 7 });
    });

    it("passes the same immutable claim to worker.performJob", async () => {
        const manager = new WorkerManager();
        const claim = { jobId: "job-1", version: 7 };

        await (manager as any).executeJob(claim);

        expect(worker.performJob).toHaveBeenCalledWith(claim);
    });
});
