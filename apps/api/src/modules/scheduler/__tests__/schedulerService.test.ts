import { beforeEach, describe, expect, it, vi, Mock } from "vitest";

const { mockPrisma, mockCheckCredits, mockDeductCredits, mockEnqueue } = vi.hoisted(() => ({
    mockPrisma: {
        schedule: { findMany: vi.fn(), updateMany: vi.fn() },
        scheduleLog: { create: vi.fn() },
    },
    mockCheckCredits: vi.fn(),
    mockDeductCredits: vi.fn(),
    mockEnqueue: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/credits", () => ({ checkCredits: mockCheckCredits, deductCredits: mockDeductCredits }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: mockEnqueue } }));

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
        mockDeductCredits.mockResolvedValue(undefined);
        mockPrisma.scheduleLog.create.mockResolvedValue({});
        mockEnqueue.mockResolvedValue({ id: "job-1" });
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
});
