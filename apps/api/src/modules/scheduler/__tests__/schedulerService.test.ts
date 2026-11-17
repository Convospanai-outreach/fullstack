import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

const { mockPrisma, mockCheckCredits, mockDeductCredits, mockRefundCredits, mockEnqueue, mockNeedsApproval } = vi.hoisted(() => ({
    mockNeedsApproval: vi.fn(),
    mockPrisma: {
        schedule: { findMany: vi.fn(), updateMany: vi.fn() },
        scheduleLog: { create: vi.fn() },
    },
    mockCheckCredits: vi.fn(),
    mockDeductCredits: vi.fn(),
    mockRefundCredits: vi.fn(),
    mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ checkCredits: mockCheckCredits, deductCredits: mockDeductCredits, refundCredits: mockRefundCredits }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));
vi.mock("@/lib/governance/campaignStartApproval", () => ({ campaignStartNeedsApproval: mockNeedsApproval }));

import { schedulerService } from "../schedulerService";

const NOW = new Date("2026-09-18T12:00:00.000Z");
const PRIOR_NEXT_RUN_AT = new Date("2026-09-18T11:00:00.000Z");

function dueSchedule(overrides: Partial<{ id: string; campaignId: string | null; agentId: string | null; name: string }> = {}) {
    return {
        id: overrides.id ?? "sched-1",
        name: overrides.name ?? "Nightly run",
        cron: "0 * * * *",
        timezone: "UTC",
        isActive: true,
        nextRunAt: PRIOR_NEXT_RUN_AT,
        teamId: "team-1",
        campaignId: overrides.campaignId ?? "campaign-1",
        agentId: overrides.agentId ?? null,
        batchSize: 50,
        groundingConfig: null,
        team: { id: "team-1" },
    };
}

describe("SchedulerService.processDueSchedules", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        mockCheckCredits.mockResolvedValue(true);
        mockDeductCredits.mockResolvedValue(true);
        mockRefundCredits.mockResolvedValue(undefined);
        mockPrisma.scheduleLog.create.mockResolvedValue({});
        mockEnqueue.mockResolvedValue({ id: "job-1" });
        mockNeedsApproval.mockResolvedValue(false);
    });

    it("claims the schedule's nextRunAt via CAS before enqueueing (B-03 regression: no double-dispatch)", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });

        const results = await schedulerService.processDueSchedules();

        expect(mockPrisma.schedule.updateMany).toHaveBeenCalledWith({
            where: { id: "sched-1", nextRunAt: PRIOR_NEXT_RUN_AT },
            data: { lastRunAt: NOW, nextRunAt: expect.any(Date) },
        });
        // The CAS claim must happen before the job is enqueued.
        const updateManyOrder = (mockPrisma.schedule.updateMany as Mock).mock.invocationCallOrder[0];
        const enqueueOrder = (mockEnqueue as Mock).mock.invocationCallOrder[0];
        expect(updateManyOrder).toBeLessThan(enqueueOrder);
        expect(results).toEqual([{ id: "sched-1", status: "dispatched" }]);
    });

    it("does not start a campaign whose team policy requires approval that has not been granted", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });
        mockNeedsApproval.mockResolvedValue(true);

        const results = await schedulerService.processDueSchedules();

        expect(mockNeedsApproval).toHaveBeenCalledWith("team-1", "campaign-1");
        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockDeductCredits).not.toHaveBeenCalled();
        expect(mockPrisma.scheduleLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ scheduleId: "sched-1", status: "failed", message: expect.stringContaining("approval") }),
        });
        expect(results).toEqual([{ id: "sched-1", status: "skipped" }]);
    });

    it("still advances nextRunAt for a skipped run, so it logs once per cron occurrence and not on every tick", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });
        mockNeedsApproval.mockResolvedValue(true);

        await schedulerService.processDueSchedules();

        expect(mockPrisma.schedule.updateMany).toHaveBeenCalledWith({
            where: { id: "sched-1", nextRunAt: PRIOR_NEXT_RUN_AT },
            data: { lastRunAt: NOW, nextRunAt: expect.any(Date) },
        });
    });

    it("does not consult the approval policy for a schedule that runs an agent, not a campaign", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([{ ...dueSchedule(), campaignId: null, agentId: "agent-1" }]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });

        await schedulerService.processDueSchedules();

        expect(mockNeedsApproval).not.toHaveBeenCalled();
        expect(mockEnqueue).toHaveBeenCalledWith("agent_run", expect.anything(), expect.anything());
    });

    it("skips enqueueing when another tick already claimed the schedule (CAS lost)", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 0 });

        const results = await schedulerService.processDueSchedules();

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockDeductCredits).not.toHaveBeenCalled();
        expect(results).toEqual([]);
    });

    it("enqueues with an idempotencyKey scoped to this schedule and the run it is servicing", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule({ id: "sched-42" })]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });

        await schedulerService.processDueSchedules();

        expect(mockEnqueue).toHaveBeenCalledWith(
            "campaign_execution",
            expect.objectContaining({ scheduleId: "sched-42" }),
            expect.objectContaining({ idempotencyKey: `sched_sched-42_${PRIOR_NEXT_RUN_AT.toISOString()}` })
        );
    });

    it("does not claim or enqueue when the team lacks credits", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockCheckCredits.mockResolvedValue(false);

        const results = await schedulerService.processDueSchedules();

        expect(mockPrisma.schedule.updateMany).not.toHaveBeenCalled();
        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(results).toEqual([]);
    });

    it("charges the run before enqueueing, and skips it when the atomic debit is refused", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });

        await schedulerService.processDueSchedules();
        expect((mockDeductCredits as Mock).mock.invocationCallOrder[0]).toBeLessThan((mockEnqueue as Mock).mock.invocationCallOrder[0]);

        vi.clearAllMocks();
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });
        // The pre-check passed, but a concurrent run spent the last credit.
        mockDeductCredits.mockResolvedValue(false);

        const results = await schedulerService.processDueSchedules();

        expect(mockEnqueue).not.toHaveBeenCalled();
        expect(mockPrisma.scheduleLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ scheduleId: "sched-1", status: "failed", message: "Insufficient credits" }),
        });
        expect(results).toEqual([{ id: "sched-1", status: "skipped" }]);
    });

    it("hands the run back and refunds the credit when the enqueue fails, so the next tick retries it", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule()]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });
        mockEnqueue.mockRejectedValue(new Error("queue unavailable"));

        const results = await schedulerService.processDueSchedules();

        const claimedNextRunAt = (mockPrisma.schedule.updateMany as Mock).mock.calls[0][0].data.nextRunAt;
        expect(mockPrisma.schedule.updateMany).toHaveBeenLastCalledWith({
            where: { id: "sched-1", nextRunAt: claimedNextRunAt },
            data: { nextRunAt: PRIOR_NEXT_RUN_AT, lastRunAt: null },
        });
        expect(mockRefundCredits).toHaveBeenCalledWith("team-1", 1, expect.any(String), { scheduleId: "sched-1" });
        expect(results).toEqual([{ id: "sched-1", status: "error", error: "queue unavailable" }]);
    });

    it("keeps processing the tick when logging a failure also fails", async () => {
        mockPrisma.schedule.findMany.mockResolvedValue([dueSchedule({ id: "sched-1" }), dueSchedule({ id: "sched-2" })]);
        mockPrisma.schedule.updateMany.mockResolvedValue({ count: 1 });
        mockEnqueue.mockRejectedValueOnce(new Error("queue unavailable")).mockResolvedValueOnce({ id: "job-2" });
        mockPrisma.scheduleLog.create.mockRejectedValueOnce(new Error("db down")).mockResolvedValue({});

        const results = await schedulerService.processDueSchedules();

        expect(results).toEqual([
            { id: "sched-1", status: "error", error: "queue unavailable" },
            { id: "sched-2", status: "dispatched" },
        ]);
    });
});
