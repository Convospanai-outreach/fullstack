import CronExpressionParser from "cron-parser";
import { prisma } from "@/lib/db";
import { JobQueue, JobType } from "@/lib/queue";
import { checkCredits, deductCredits, refundCredits } from "@/lib/credits"; // Assuming these exist or will use billingService
import { campaignStartNeedsApproval } from "@/lib/governance/campaignStartApproval";

export class SchedulerService {
    /**
     * Create a new schedule
     */
    async createSchedule(data: {
        name: string;
        cron: string;
        teamId: string;
        campaignId?: string;
        agentId?: string;
        batchSize?: number;
        groundingConfig?: any;
        timezone?: string;
    }) {
        // Validate cron
        try {
            CronExpressionParser.parse(data.cron);
        } catch (err) {
            throw new Error("Invalid cron expression");
        }

        // Calculate next run
        const interval = CronExpressionParser.parse(data.cron, { tz: data.timezone || "UTC" });
        const nextRunAt = interval.next().toDate();

        return prisma.schedule.create({
            data: {
                ...data,
                nextRunAt,
            },
        });
    }

    /**
     * The "Tick": Process all due schedules
     */
    async processDueSchedules() {
        const now = new Date();

        // 1. Find due schedules
        const dueSchedules = await prisma.schedule.findMany({
            where: {
                isActive: true,
                nextRunAt: { lte: now },
            },
            include: {
                team: true,
            },
        });

        const results = [];

        for (const schedule of dueSchedules) {
            try {
                // 2. Check Credits (Prevent abuse)
                // Estimate cost: 1 credit per run (simplification)
                const hasCredits = await checkCredits(schedule.teamId, 1);
                if (!hasCredits) {
                    // Log failure and skip
                    await this.logExecution(schedule.id, "failed", "Insufficient credits", 0, 0);
                    continue;
                }

                // 3. Claim this due run before enqueueing anything. Two ticks
                // racing on the same schedule (overlapping slow ticks, or the
                // worker running on more than one host) would otherwise both
                // read the same nextRunAt and both enqueue - this atomic
                // updateMany only succeeds for whichever tick gets there
                // first, so the loser's count is 0 and it skips the schedule
                // entirely instead of double-dispatching.
                const interval = CronExpressionParser.parse(schedule.cron, { tz: schedule.timezone });
                const nextRun = interval.next().toDate();
                const claim = await prisma.schedule.updateMany({
                    where: { id: schedule.id, nextRunAt: schedule.nextRunAt },
                    data: {
                        lastRunAt: now,
                        nextRunAt: nextRun,
                    },
                });
                if (claim.count === 0) {
                    continue;
                }

                // A team whose policy requires approval to start campaigns must not get one started
                // here without it. Checked after the claim so a skipped occurrence is logged once
                // and the schedule moves on to its next cron time, instead of re-logging every tick.
                if (schedule.campaignId && await campaignStartNeedsApproval(schedule.teamId, schedule.campaignId)) {
                    await this.logExecution(schedule.id, "failed", "Skipped: starting this campaign requires approval. Start it from the campaign page to request one.", 0, 0);
                    results.push({ id: schedule.id, status: "skipped" });
                    continue;
                }

                // 4. Charge the run before dispatching it. checkCredits above is only a
                // pre-filter (two runs can both pass it); this conditional debit is the
                // atomic check, and a run it refuses is not dispatched.
                const debited = await deductCredits(schedule.teamId, 1, "Scheduled Run Execution", { scheduleId: schedule.id });
                if (!debited) {
                    await this.logExecution(schedule.id, "failed", "Insufficient credits", 0, 0);
                    results.push({ id: schedule.id, status: "skipped" });
                    continue;
                }

                // 5. Dispatch Job
                // Payload includes batch settings and grounding config
                const payload = {
                    scheduleId: schedule.id,
                    campaignId: schedule.campaignId,
                    agentId: schedule.agentId,
                    batchSize: schedule.batchSize,
                    groundingConfig: schedule.groundingConfig,
                    teamId: schedule.teamId
                };

                // If it's a campaign, we might trigger a specific job type
                // Mapping to existing types in JobQueue
                // Default to campaign_execution if campaignId exists, else agent_run
                let jobType: JobType = "agent_run";
                if (schedule.campaignId) jobType = "campaign_execution";
                else if (schedule.agentId) jobType = "agent_run";
                else if (schedule.name.toLowerCase().includes("scoring")) jobType = "lead_scoring";

                // Belt-and-braces on top of the CAS claim above: keyed on the
                // schedule id and the nextRunAt value this tick is servicing,
                // so even a duplicate enqueue call for the same due run is a
                // no-op at the job-queue layer.
                try {
                    await JobQueue.enqueue(jobType, payload, {
                        priority: 1,
                        teamId: schedule.teamId,
                        idempotencyKey: `sched_${schedule.id}_${schedule.nextRunAt?.toISOString()}`,
                    });
                } catch (error) {
                    // Hand the occurrence back so the next tick retries it instead of skipping
                    // it (the idempotency key keeps the retry from double-dispatching), and
                    // return the credit.
                    const rollback = await Promise.allSettled([
                        prisma.schedule.updateMany({
                            where: { id: schedule.id, nextRunAt: nextRun },
                            data: { nextRunAt: schedule.nextRunAt, lastRunAt: schedule.lastRunAt ?? null },
                        }),
                        refundCredits(schedule.teamId, 1, "Scheduled Run Execution (dispatch failed)", { scheduleId: schedule.id }),
                    ]);
                    for (const step of rollback) {
                        if (step.status === "rejected") console.error(`Failed to roll back schedule ${schedule.id} after a failed dispatch:`, step.reason);
                    }
                    throw error;
                }

                // 6. Audit Log (Initial)
                await this.logExecution(schedule.id, "success", "Job dispatched", 0, 1);

                results.push({ id: schedule.id, status: "dispatched" });

            } catch (error: any) {
                console.error(`Failed to process schedule ${schedule.id}:`, error);
                // A failed log write must not stop the remaining due schedules in this tick.
                await this.logExecution(schedule.id, "failed", error.message, 0, 0).catch((logError) =>
                    console.error(`Failed to log the failure of schedule ${schedule.id}:`, logError)
                );
                results.push({ id: schedule.id, status: "error", error: error.message });
            }
        }

        return results;
    }

    /**
     * Helper to log execution
     */
    async logExecution(scheduleId: string, status: string, message: string, tokens: number, credits: number) {
        return prisma.scheduleLog.create({
            data: {
                scheduleId,
                status,
                message,
                tokensUsed: tokens,
                creditsUsed: credits,
            },
        });
    }

    /**
     * Helper executed by the Worker to update stats after job completion
     */
    async updateStats(scheduleId: string, tokens: number, credits: number, items: number) {
        // We might want to update the last log or create a new detailed log
        // For simplicity, let's append a log entry for "completion"
        return prisma.scheduleLog.create({
            data: {
                scheduleId,
                status: "completed",
                message: "Worker finished batch",
                tokensUsed: tokens,
                creditsUsed: credits,
                itemsVariable: items
            }
        });
    }
}

export const schedulerService = new SchedulerService();
