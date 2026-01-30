
import { prisma } from "@/lib/db";
import { Job } from "@prisma/client";

export type JobType = "campaign_execution" | "lead_enrichment" | "email_sending" | "linkedin_scraping" | "agent_run" | "agent_stop" | "data_export" | "LINKEDIN_ACTION" | "INBOX_SYNC" | "CRM_SYNC" | "WEBHOOK_DISPATCH" | "workflow_step";

export interface JobPayload {
    leadId?: string | undefined;
    url?: string | undefined;
    action?: string | undefined;
    templateId?: string | undefined;
    teamId?: string | undefined;
    userId?: string | undefined;
    text?: string | undefined;
    // Catch-all for dynamic payload data
    [key: string]: any;
}

export class JobQueue {
    /**
     * Enqueue a new job
     */
    static async enqueue(
        type: JobType,
        payload: JobPayload,
        options: {
            priority?: number;
            processAt?: Date | null;
            teamId?: string | null;
            idempotencyKey?: string;
        } = {}
    ): Promise<Job> {
        // If idempotencyKey is provided, check for existing job
        if (options.idempotencyKey) {
            const existingJob = await prisma.job.findUnique({
                where: { idempotencyKey: options.idempotencyKey }
            });
            if (existingJob) return existingJob;
        }

        const data: any = {
            type,
            payload,
            priority: options.priority ?? 0,
            processAt: options.processAt ?? new Date(),
            teamId: options.teamId ?? null,
            status: "pending",
        };

        if (options.idempotencyKey) {
            data.idempotencyKey = options.idempotencyKey;
        }

        return await prisma.job.create({ data });
    }

    /**
     * Dequeue the next available job
     * Uses a transaction to lock the job row
     */
    static async dequeue(): Promise<Job | null> {
        const now = new Date();

        // Find next eligible job
        const candidates = await prisma.job.findMany({
            where: {
                status: "pending",
                processAt: { lte: now },
            },
            orderBy: [
                { priority: "desc" },
                { processAt: "asc" },
            ],
            take: 5,
        });

        for (const candidate of candidates) {
            try {
                // Try to claim it
                const claimed = await prisma.job.update({
                    where: {
                        id: candidate.id,
                        status: "pending" // Optimistic locking
                    },
                    data: {
                        status: "processing",
                        startedAt: new Date(),
                        attempts: { increment: 1 }
                    }
                });
                return claimed;
            } catch (err) {
                // Concurrency: someone else grabbed it, try next
                continue;
            }
        }

        return null;
    }

    /**
     * Mark job as completed
     */
    static async complete(jobId: string, result?: any) {
        return await prisma.job.update({
            where: { id: jobId },
            data: {
                status: "completed",
                completedAt: new Date(),
                result: result || {},
            },
        });
    }

    /**
     * Mark job as failed. Retry if attempts < maxAttempts.
     */
    static async fail(jobId: string, error: string) {
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) return;

        const isRetryable = job.attempts < job.maxAttempts;

        if (isRetryable) {
            // Schedule retry with exponential backoff
            const backoffSeconds = Math.pow(2, job.attempts) * 30; // 30s, 60s, 120s...
            const nextProcessAt = new Date(Date.now() + backoffSeconds * 1000);

            return await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: "pending", // Reset to pending for retry
                    error: error,
                    processAt: nextProcessAt,
                },
            });
        } else {
            // Permanent failure -> Dead Letter
            return await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: "dead_letter",
                    completedAt: new Date(),
                    error: error,
                },
            });
        }
    }

    /**
     * Resets jobs stuck in 'processing' for too long.
     * This protects against worker crashes.
     */
    static async resetStaleJobs(maxAgeMs: number = 1000 * 60 * 15) {
        const threshold = new Date(Date.now() - maxAgeMs);

        const staleJobs = await prisma.job.findMany({
            where: {
                status: "processing",
                startedAt: { lte: threshold }
            }
        });

        if (staleJobs.length === 0) return 0;

        console.log(`[JobQueue] Resetting ${staleJobs.length} stale jobs to pending.`);

        const result = await prisma.job.updateMany({
            where: {
                id: { in: staleJobs.map(j => j.id) }
            },
            data: {
                status: "pending",
                error: "Stale job reset by watchdog."
            }
        });

        return result.count;
    }
}
