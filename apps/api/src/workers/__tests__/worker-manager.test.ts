import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { JobQueue } from "@/lib/queue";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";
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

vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({
    SequenceService: { processDue: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    renewDueGoogleMailboxWatches: vi.fn().mockResolvedValue([]),
    syncDueGoogleMailboxes: vi.fn().mockResolvedValue([]),
    advanceMailboxWarmup: vi.fn().mockResolvedValue({ count: 0 }),
}));

vi.mock("@/modules/email-campaigner/service/warmupSeedService", () => ({
    sendWarmupSeedTraffic: vi.fn().mockResolvedValue({ sent: 0 }),
}));

vi.mock("../job-processor", () => ({
    worker: { performJob: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("@/lib/outboxService", () => ({
    OutboxService: { relayPendingEvents: vi.fn().mockResolvedValue(0) },
}));

vi.mock("@/modules/governance/ApprovalService", () => ({
    ApprovalService: { autoDenyExpiredApprovals: vi.fn().mockResolvedValue(0) },
}));

vi.mock("../handlers/overseerHandler", () => ({
    processOverseerTick: vi.fn().mockResolvedValue({ candidates: 0, nudgesCreated: 0 }),
}));

vi.mock("@/modules/overseer/breakerService", () => ({
    evaluateBreakers: vi.fn().mockResolvedValue({ teamsEvaluated: 0, tripped: 0 }),
}));

vi.mock("@/modules/overseer/overseerSignalService", () => ({
    detectProviderDegradation: vi.fn().mockResolvedValue({ providersChecked: 0, signalsOpened: 0, signalsResolved: 0 }),
}));

vi.mock("../handlers/facebook-leads-worker", () => ({
    syncDueFacebookLeadSources: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/modules/branding/customDomainPoller", () => ({
    pollPendingCustomDomains: vi.fn().mockResolvedValue([]),
}));

describe("WorkerManager claim propagation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("passes the exact concrete dequeue version to executeJob", async () => {
        const manager = new WorkerManager();
        const executeJob = vi.spyOn(manager as any, "executeJob").mockImplementation(async () => {
            await manager.stop();
        });
        vi.spyOn(manager as any, "handleMaintenanceTick").mockResolvedValue(undefined);
        (JobQueue.dequeue as Mock).mockResolvedValueOnce({ id: "job-1", version: 7 });

        await manager.start();

        expect(executeJob).toHaveBeenCalledWith({ jobId: "job-1", version: 7 });
    });

    it("passes the same immutable claim to worker.performJob", async () => {
        const manager = new WorkerManager();
        const claim = { jobId: "job-1", version: 7 };

        await (manager as any).executeJob(claim);

        expect(worker.performJob).toHaveBeenCalledWith(claim);
    });

    it("tracks concurrent versions of one job independently and drains both claim generations", async () => {
        const manager = new WorkerManager();
        let resolveOld!: () => void;
        let resolveNew!: () => void;
        const oldExecution = new Promise<void>((resolve) => { resolveOld = resolve; });
        const newExecution = new Promise<void>((resolve) => { resolveNew = resolve; });
        (worker.performJob as Mock)
            .mockImplementationOnce(() => oldExecution)
            .mockImplementationOnce(() => newExecution);

        const oldClaim = (manager as any).executeJob({ jobId: "job-1", version: 1 });
        const newClaim = (manager as any).executeJob({ jobId: "job-1", version: 2 });
        expect((manager as any).activeJobs.size).toBe(2);

        let stopped = false;
        const stopping = manager.stop().then(() => { stopped = true; });
        await Promise.resolve();
        expect(stopped).toBe(false);

        resolveOld();
        await oldClaim;
        expect((manager as any).activeJobs.size).toBe(1);
        expect(stopped).toBe(false);

        resolveNew();
        await newClaim;
        await stopping;
        expect((manager as any).activeJobs.size).toBe(0);
    });

    it("tracks distinct job IDs normally", async () => {
        const manager = new WorkerManager();
        let resolveFirst!: () => void;
        let resolveSecond!: () => void;
        (worker.performJob as Mock)
            .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveFirst = resolve; }))
            .mockImplementationOnce(() => new Promise<void>((resolve) => { resolveSecond = resolve; }));

        const first = (manager as any).executeJob({ jobId: "job-1", version: 1 });
        const second = (manager as any).executeJob({ jobId: "job-2", version: 1 });
        expect((manager as any).activeJobs.size).toBe(2);

        resolveFirst();
        resolveSecond();
        await Promise.all([first, second]);
        expect((manager as any).activeJobs.size).toBe(0);
    });
});

describe("WorkerManager maintenance tick", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("processes due sequence steps on the maintenance tick", async () => {
        const manager = new WorkerManager();

        await (manager as any).handleMaintenanceTick();

        expect(SequenceService.processDue).toHaveBeenCalledWith({});
    });

    it("does not re-run sequence processing before its interval elapses", async () => {
        const manager = new WorkerManager();

        await (manager as any).handleMaintenanceTick();
        await (manager as any).handleMaintenanceTick();

        expect(SequenceService.processDue).toHaveBeenCalledTimes(1);
    });
});
