import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { JOB_STATUS } from "@/lib/queue";

// roadmap 3.2 (I-08): daily retention for append-only log tables, run from the
// WorkerManager maintenance tick.
//
// Safe by default: unless RETENTION_ENABLED is exactly "true" this only counts
// and logs the rows each table WOULD lose. Deletion is irreversible, so the
// owner turns it on after reviewing those dry-run counts. Each window can be
// overridden with its env var (a positive whole number of days).
//
// Deliberately not swept here:
// - Activity: the user-visible campaign timeline (a product decision).
// - AuditLog: keeps its own archive script (src/scripts/archive-audit-logs.ts).

const DAY_MS = 24 * 60 * 60 * 1000;

// Bounded work per tick: the tick is awaited before job dequeue, and short
// batched deletes avoid holding long row locks.
export const RETENTION_BATCH_SIZE = 1000;
export const RETENTION_MAX_BATCHES_PER_TABLE = 20;

type RetentionDelegate = {
    count(args: { where: object }): Promise<number>;
    findMany(args: { where: object; select: { id: true }; take: number }): Promise<Array<{ id: string }>>;
    deleteMany(args: { where: object }): Promise<{ count: number }>;
};

type RetentionTarget = {
    table: string;
    delegate: () => RetentionDelegate;
    envVar: string;
    defaultDays: number;
    // Only rows matching this predicate are ever counted or deleted.
    where: (cutoff: Date) => object;
};

export const RETENTION_TARGETS: RetentionTarget[] = [
    {
        // Finished jobs only; queued, pending and running rows are never touched.
        table: "Job",
        delegate: () => prisma.job as unknown as RetentionDelegate,
        envVar: "RETENTION_JOB_DAYS",
        defaultDays: 90,
        where: (cutoff) => ({
            status: { in: [JOB_STATUS.SUCCEEDED, JOB_STATUS.DEAD_LETTERED] },
            completedAt: { lt: cutoff },
        }),
    },
    {
        // Delivered events only; PENDING, PROCESSING and FAILED rows stay.
        table: "OutboxEvent",
        delegate: () => prisma.outboxEvent as unknown as RetentionDelegate,
        envVar: "RETENTION_OUTBOX_EVENT_DAYS",
        defaultDays: 30,
        where: (cutoff) => ({ status: "RELAYED", createdAt: { lt: cutoff } }),
    },
    {
        // Read notifications only; unread ones are never touched.
        table: "Notification",
        delegate: () => prisma.notification as unknown as RetentionDelegate,
        envVar: "RETENTION_NOTIFICATION_DAYS",
        defaultDays: 90,
        where: (cutoff) => ({ read: true, createdAt: { lt: cutoff } }),
    },
    {
        table: "LLMUsageLog",
        delegate: () => prisma.lLMUsageLog as unknown as RetentionDelegate,
        envVar: "RETENTION_LLM_USAGE_LOG_DAYS",
        defaultDays: 365,
        where: (cutoff) => ({ createdAt: { lt: cutoff } }),
    },
    {
        table: "EmailEvent",
        delegate: () => prisma.emailEvent as unknown as RetentionDelegate,
        envVar: "RETENTION_EMAIL_EVENT_DAYS",
        defaultDays: 365,
        where: (cutoff) => ({ createdAt: { lt: cutoff } }),
    },
    {
        table: "LandingEvent",
        delegate: () => prisma.landingEvent as unknown as RetentionDelegate,
        envVar: "RETENTION_LANDING_EVENT_DAYS",
        defaultDays: 365,
        where: (cutoff) => ({ createdAt: { lt: cutoff } }),
    },
];

export type RetentionResult = {
    table: string;
    days: number;
    mode: "dry-run" | "delete";
    count: number;
    error?: string;
};

function retentionDays(target: RetentionTarget): number {
    const parsed = Number(process.env[target.envVar]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : target.defaultDays;
}

// Never throws: a failing table is logged and skipped so the rest still run and
// the caller's tick timestamp still advances (no retry every loop iteration).
export async function runRetentionSweep(now: Date = new Date()): Promise<RetentionResult[]> {
    const enabled = process.env["RETENTION_ENABLED"] === "true";
    const mode = enabled ? "delete" : "dry-run";
    const results: RetentionResult[] = [];

    for (const target of RETENTION_TARGETS) {
        const days = retentionDays(target);
        const where = target.where(new Date(now.getTime() - days * DAY_MS));

        try {
            const delegate = target.delegate();
            let count = 0;

            if (!enabled) {
                count = await delegate.count({ where });
            } else {
                for (let batch = 0; batch < RETENTION_MAX_BATCHES_PER_TABLE; batch++) {
                    const rows = await delegate.findMany({ where, select: { id: true }, take: RETENTION_BATCH_SIZE });
                    if (rows.length === 0) break;
                    // Re-apply the predicate so a row that changed state between
                    // the select and the delete is left alone.
                    const deleted = await delegate.deleteMany({
                        where: { ...where, id: { in: rows.map((row) => row.id) } },
                    });
                    count += deleted.count;
                    if (rows.length < RETENTION_BATCH_SIZE) break;
                }
            }

            logger.info(
                enabled
                    ? `[Retention] Deleted ${count} ${target.table} row(s) older than ${days} day(s).`
                    : `[Retention] Dry run: ${count} ${target.table} row(s) older than ${days} day(s) would be deleted. Set RETENTION_ENABLED=true to delete.`,
                { table: target.table, days, mode, count, category: "worker" }
            );
            results.push({ table: target.table, days, mode, count });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logger.error(`[Retention] ${target.table} sweep failed: ${message.slice(0, 500)}`, { table: target.table, mode, category: "worker" });
            results.push({ table: target.table, days, mode, count: 0, error: message });
        }
    }

    return results;
}
