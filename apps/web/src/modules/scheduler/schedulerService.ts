import CronExpressionParser from "cron-parser";
import { prisma } from "@/lib/db";
import { JobQueue, JobType } from "@/lib/queue";
import { checkCredits, deductCredits } from "@/lib/credits"; // Assuming these exist or will use billingService

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

                // 3. Dispatch Job
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

                await JobQueue.enqueue(jobType, payload, { priority: 1, teamId: schedule.teamId });

                // 4. Update Next Run
                const interval = CronExpressionParser.parse(schedule.cron, { tz: schedule.timezone });
                const nextRun = interval.next().toDate();

                await prisma.schedule.update({
                    where: { id: schedule.id },
                    data: {
                        lastRunAt: now,
                        nextRunAt: nextRun,
                    },
                });

                // 5. Audit Log (Initial)
                // Deduct startup credit
                await deductCredits(schedule.teamId, 1, "Scheduled Run Execution", { scheduleId: schedule.id });
                await this.logExecution(schedule.id, "success", "Job dispatched", 0, 1);

                results.push({ id: schedule.id, status: "dispatched" });

            } catch (error: any) {
                console.error(`Failed to process schedule ${schedule.id}:`, error);
                await this.logExecution(schedule.id, "failed", error.message, 0, 0);
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
