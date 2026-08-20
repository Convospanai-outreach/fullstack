
import { prisma } from "@/lib/db";
import { Job } from "@prisma/client";
import { EXECUTION_MODES, RUNTIME_TARGETS } from "@/contracts/executionModes";
import { NotificationDispatcher } from "@/lib/notifications";

/**
 * The WorkerManager-owned queue uses lowercase status values. Uppercase values
 * such as `PENDING` are not part of this queue's claim contract.
 */
export const JOB_STATUS = {
    QUEUED: "queued",
    PENDING: "pending",
    RUNNING: "running",
    PROCESSING: "processing",
    SUCCEEDED: "succeeded",
    DEAD_LETTERED: "dead_lettered",
} as const;

const DEQUEUEABLE_JOB_STATUSES: string[] = [JOB_STATUS.QUEUED, JOB_STATUS.PENDING];
const RECOVERABLE_STALE_JOB_STATUSES: string[] = [JOB_STATUS.RUNNING, JOB_STATUS.PROCESSING];

export const STALE_JOB_RECOVERY_PAGE_SIZE = 100;
export const STALE_JOB_RECOVERY_MAX_CONCURRENT_WRITES = 5;

/** A claim is immutable for the lifetime of one worker execution. */
export type JobClaim = Readonly<{
    jobId: string;
    version: number;
}>;

export type ClaimedJob = Job & { version: number };

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
    | "SEQUENCE_ACTION"
    | "sequence_execution"
    | "INTEL_FOLLOWUP_REFRESH"
    | "lead_scoring"
    | "order_captured";

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

export class JobClaimLostError extends Error {
    constructor(jobId: string) {
        super(`Job claim ownership was lost for job ${jobId}.`);
        this.name = "JobClaimLostError";
    }
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
            status: JOB_STATUS.QUEUED,
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

        try {
            return await prisma.job.create({ data });
        } catch (error: any) {
            if (error?.code === "P2002" && options.idempotencyKey) {
                const target = error.meta?.target;
                const targetFields = Array.isArray(target)
                    ? target.filter((value): value is string => typeof value === "string")
                    : typeof target === "string"
                        ? [target]
                        : [];
                const isIdempotencyConflict = targetFields.some((value) => {
                    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
                    return normalized.includes("idempotencykey");
                });
                if (isIdempotencyConflict) {
                    const existingJob = await prisma.job.findUnique({
                        where: { idempotencyKey: options.idempotencyKey }
                    });
                    if (existingJob) return existingJob;
                }
            }
            throw error;
        }
    }

    /**
     * Dequeue the next available job
     * Uses a transaction to lock the job row
     */
    static async dequeue(): Promise<ClaimedJob | null> {
        const now = new Date();

        // Find next eligible job
        const candidates = await prisma.job.findMany({
            where: {
                status: { in: DEQUEUEABLE_JOB_STATUSES },
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
                // Claim atomically: only return the job if the row is still eligible.
                const nextClaimVersion = (candidate.version ?? 0) + 1;
                const claim = await prisma.job.updateMany({
                    where: {
                        id: candidate.id,
                        status: { in: DEQUEUEABLE_JOB_STATUSES },
                        processAt: { lte: now },
                        version: candidate.version,
                    },
                    data: {
                        status: JOB_STATUS.RUNNING,
                        startedAt: new Date(),
                        attempts: { increment: 1 },
                        version: nextClaimVersion,
                    }
                });

                if (claim.count === 0) {
                    continue;
                }

                const claimedJob = await prisma.job.findFirst({
                    where: { id: candidate.id, status: JOB_STATUS.RUNNING, version: nextClaimVersion }
                });

                if (claimedJob && claimedJob.version === nextClaimVersion) {
                    return { ...claimedJob, version: nextClaimVersion };
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
    static async complete(jobId: string, claimVersion: number, result?: any) {
        const completed = await prisma.job.updateMany({
            where: { id: jobId, status: JOB_STATUS.RUNNING, version: claimVersion },
            data: {
                status: JOB_STATUS.SUCCEEDED,
                completedAt: new Date(),
                result: result || {},
            },
        });

        if (completed.count !== 1) {
            throw new JobClaimLostError(jobId);
        }

        return prisma.job.findUnique({ where: { id: jobId } });
    }

    static async assertClaim(jobId: string, claimVersion: number) {
        const owned = await prisma.job.updateMany({
            where: { id: jobId, status: JOB_STATUS.RUNNING, version: claimVersion },
            data: { version: claimVersion },
        });

        if (owned.count !== 1) {
            throw new JobClaimLostError(jobId);
        }
    }

    /**
     * Requeue a currently running job without consuming its claim attempt.
     */
    static async defer(
        jobId: string,
        claimVersion: number,
        options: { processAt: Date; reason: "MAILBOX_LEASE_CONTENDED" }
    ) {
        const deferred = await prisma.job.updateMany({
            where: {
                id: jobId,
                status: JOB_STATUS.RUNNING,
                version: claimVersion,
                attempts: { gt: 0 },
            },
            data: {
                status: JOB_STATUS.QUEUED,
                processAt: options.processAt,
                startedAt: null,
                error: options.reason,
                attempts: { decrement: 1 },
            },
        });
        if (deferred.count !== 1) {
            throw new JobClaimLostError(jobId);
        }
        return prisma.job.findUnique({ where: { id: jobId } });
    }

    /**
     * Mark job as failed. Retry if attempts < maxAttempts.
     */
    static async fail(jobId: string, claimVersion: number, error: string) {
        const job = await prisma.job.findFirst({
            where: { id: jobId, status: JOB_STATUS.RUNNING, version: claimVersion },
        });
        if (!job) throw new JobClaimLostError(jobId);

        const isRetryable = job.attempts < job.maxAttempts;

        if (isRetryable) {
            // Schedule retry with exponential backoff
            const backoffSeconds = Math.pow(2, job.attempts) * 30; // 30s, 60s, 120s...
            const nextProcessAt = new Date(Date.now() + backoffSeconds * 1000);

            const retried = await prisma.job.updateMany({
                where: { id: jobId, status: JOB_STATUS.RUNNING, version: claimVersion },
                data: {
                    status: JOB_STATUS.QUEUED, // Reset to queued for retry
                    error: error,
                    processAt: nextProcessAt,
                },
            });
            if (retried.count !== 1) throw new JobClaimLostError(jobId);
            return prisma.job.findUnique({ where: { id: jobId } });
        } else {
            // Permanent failure -> Dead Letter
            const deadLettered = await prisma.job.updateMany({
                where: { id: jobId, status: JOB_STATUS.RUNNING, version: claimVersion },
                data: {
                    status: JOB_STATUS.DEAD_LETTERED,
                    completedAt: new Date(),
                    error: error,
                },
            });
            if (deadLettered.count !== 1) throw new JobClaimLostError(jobId);

            const updatedJob = await prisma.job.findUnique({ where: { id: jobId } });
            
            const payload = job.payload as any;
            if (payload && payload.userId) {
                await NotificationDispatcher.send(
                    payload.userId,
                    "SYSTEM",
                    "Job Failed",
                    `Job ${job.type} permanently failed after ${job.attempts} attempts`,
                    { jobId: job.id, error }
                );
            }
            
            return updatedJob;
        }
    }

    /**
     * Requeues stale WorkerManager claims and invalidates their generation.
     * This protects against worker crashes.
     */
    static async resetStaleJobs(maxAgeMs: number = 1000 * 60 * 15) {
        const threshold = new Date(Date.now() - maxAgeMs);
        let afterId: string | undefined;
        let resetCount = 0;

        for (;;) {
            const staleJobs = await prisma.job.findMany({
                where: {
                    status: { in: RECOVERABLE_STALE_JOB_STATUSES },
                    startedAt: { lte: threshold },
                    ...(afterId ? { id: { gt: afterId } } : {}),
                },
                select: { id: true, status: true, version: true },
                orderBy: { id: "asc" },
                take: STALE_JOB_RECOVERY_PAGE_SIZE,
            });

            if (staleJobs.length === 0) break;

            let nextJobIndex = 0;
            const resetPage = async () => {
                let localResetCount = 0;
                while (nextJobIndex < staleJobs.length) {
                    const job = staleJobs[nextJobIndex++];
                    const result = await prisma.job.updateMany({
                        where: {
                            id: job.id,
                            status: job.status,
                            version: job.version,
                            startedAt: { lte: threshold },
                        },
                        data: {
                            status: JOB_STATUS.QUEUED,
                            startedAt: null,
                            completedAt: null,
                            error: "Stale job reset by watchdog.",
                            version: (job.version ?? 0) + 1,
                        },
                    });
                    localResetCount += result.count;
                }
                return localResetCount;
            };

            const workers = Array.from(
                { length: Math.min(STALE_JOB_RECOVERY_MAX_CONCURRENT_WRITES, staleJobs.length) },
                () => resetPage(),
            );
            const pageResults = await Promise.all(workers);
            resetCount += pageResults.reduce((count, pageCount) => count + pageCount, 0);

            afterId = staleJobs[staleJobs.length - 1].id;
            if (staleJobs.length < STALE_JOB_RECOVERY_PAGE_SIZE) break;
        }

        if (resetCount > 0) {
            console.log(`[JobQueue] Reset ${resetCount} stale jobs to queued.`);
        }
        return resetCount;
    }
}
