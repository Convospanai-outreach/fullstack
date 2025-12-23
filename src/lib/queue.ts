
import { prisma } from "@/lib/db";
import { Job, Prisma } from "@prisma/client";

export type JobType = "campaign_execution" | "lead_enrichment" | "email_sending" | "linkedin_scraping" | "agent_run" | "agent_stop" | "data_export" | "LINKEDIN_ACTION" | "INBOX_SYNC" | "CRM_SYNC" | "WEBHOOK_DISPATCH" | "workflow_step";

export interface JobPayload {
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
            processAt?: Date;
            teamId?: string;
        } = {}
    ): Promise<Job> {
        return await prisma.job.create({
            data: {
                type,
                payload,
                priority: options.priority || 0,
                processAt: options.processAt || new Date(),
                teamId: options.teamId,
                status: "pending",
            },
        });
    }

    /**
     * Dequeue the next available job
     * Uses a transaction to lock the job row
     */
    static async dequeue(): Promise<Job | null> {
        const now = new Date();

        // Find next eligible job
        // Note: In a high-concurrency environment, this simple findFirst + update
        // might have race conditions. For higher scale, consider using raw SQL
        // with SELECT ... FOR UPDATE SKIP LOCKED.
        // For this MVP, a simple atomic update should suffice for moderate load.

        // We do this in a transaction to try to ensure we only get one worker picking it up
        // However, Prisma doesn't support SELECT FOR UPDATE easily without raw queries.
        // We'll use a pragmatic approach: UPDATE ... WHERE status='pending' RETURNING *
        // but Prisma doesn't support generic UPDATE with LIMIT 1 directly easily either.

        // Strategy: Find candidates, then try to claim one.
        const candidates = await prisma.job.findMany({
            where: {
                status: "pending",
                processAt: { lte: now },
            },
            orderBy: [
                { priority: "desc" },
                { processAt: "asc" },
            ],
            take: 5, // Fetch a few to increase chance of successful claim collision-free
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
            // Permanent failure
            return await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: "failed",
                    completedAt: new Date(),
                    error: error,
                },
            });
        }
    }
}
