
import { prisma } from "@/lib/db";
import { Job } from "@prisma/client";
import { TaskState, canTransition } from "@/contracts/taskState";
import { EXECUTION_MODES, RUNTIME_TARGETS } from "@/contracts/executionModes";
import { logger } from "@/lib/logger";

function normalizeStatus(status: string): TaskState {
    switch (status) {
        case "pending":
            return "queued";
        case "processing":
            return "running";
        case "completed":
            return "succeeded";
        case "dead_letter":
            return "dead_lettered";
        default:
            return status as TaskState;
    }
}

export type JobType =
    | "campaign_execution"
    | "lead_enrichment"
    | "email_sending"
    | "linkedin_scraping"
    | "agent_run"
    | "agent_stop"
    | "data_export"
    | "LINKEDIN_ACTION"
    | "INBOX_SYNC"
    | "CRM_SYNC"
    | "WEBHOOK_DISPATCH"
    | "workflow_step"
    | "event_processing"
    | "CSV_IMPORT"
    | "SEQUENCE_ACTION";

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
            requireIdempotency?: boolean;
            version?: number;
            executionMode?: (typeof EXECUTION_MODES)[number];
            targetRuntime?: (typeof RUNTIME_TARGETS)[number];
            taskId?: string;
            expiresAt?: Date | null;
            policy?: Record<string, any> | null;
            auditContext?: Record<string, any> | null;
            correlationId?: string | null;
        } = {}
    ): Promise<Job> {
        if (options.requireIdempotency && !options.idempotencyKey) {
            throw new Error("Idempotency key required for this job type");
        }

        // If idempotencyKey is provided, check for existing job
        if (options.idempotencyKey) {
            const existingJob = await prisma.job.findUnique({
                where: { idempotencyKey: options.idempotencyKey }
            });
            if (existingJob) return existingJob;
        }

        const data: any = {
            type,
            payload: { ...payload }, // Clone to avoid mutation
            priority: options.priority ?? 0,
            processAt: options.processAt ?? new Date(),
            teamId: options.teamId ?? null,
            tenantId: options.teamId ?? null,
            status: "queued",
            version: options.version ?? 1,
            taskType: type,
            executionMode: options.executionMode ?? "saas_only",
            targetRuntime: options.targetRuntime ?? "saas_only",
            taskId: options.taskId ?? `task_${crypto.randomUUID()}`,
            expiresAt: options.expiresAt ?? null,
            policy: options.policy ?? null,
            auditContext: options.auditContext ?? null,
            correlationId: options.correlationId ?? null
        };

        // [Observability] Propagate correlationId to worker
        if (!data.payload.correlationId) {
            try {
                const { RequestContext } = await import("@/lib/requestContext");
                const cid = RequestContext.getCorrelationId();
                if (cid) {
                    data.payload.correlationId = cid;
                }
            } catch (e) { /* ignore */ }
        }

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
                status: { in: ["queued", "pending"] },
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
                // Try to claim it (support legacy "pending")
                const tryClaim = async (status: "queued" | "pending") => {
                    return await prisma.job.update({
                        where: {
                            id: candidate.id,
                            status
                        },
                        data: {
                            status: "running",
                            startedAt: new Date(),
                            attempts: { increment: 1 }
                        }
                    });
                };
                try {
                    return await tryClaim("queued");
                } catch (e) {
                    return await tryClaim("pending");
                }
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
        const job = await prisma.job.findUnique({ where: { id: jobId } });
        if (!job) return;
        const current = normalizeStatus(job.status);
        if (!canTransition(current, "succeeded")) {
            throw new Error(`Invalid state transition from ${job.status} to succeeded`);
        }
        return await prisma.job.update({
            where: { id: jobId },
            data: {
                status: "succeeded",
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
                    status: "queued", // Reset to queued for retry
                    error: error,
                    processAt: nextProcessAt,
                },
            });
        } else {
            // Permanent failure -> Dead Letter
            return await prisma.job.update({
                where: { id: jobId },
                data: {
                    status: "dead_lettered",
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
                status: { in: ["running", "processing"] },
                startedAt: { lte: threshold }
            }
        });

        if (staleJobs.length === 0) return 0;

        logger.info(`[JobQueue] Resetting stale jobs to pending`, { count: staleJobs.length });

        const result = await prisma.job.updateMany({
            where: {
                id: { in: staleJobs.map(j => j.id) }
            },
            data: {
                status: "queued",
                error: "Stale job reset by watchdog."
            }
        });

        return result.count;
    }
}
