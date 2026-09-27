import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as Record<string, any> }));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import {
    RETENTION_BATCH_SIZE,
    RETENTION_MAX_BATCHES_PER_TABLE,
    RETENTION_TARGETS,
    runRetentionSweep,
} from "../retentionSweep";

const NOW = new Date("2026-09-26T03:00:00.000Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

type Row = { id: string } & Record<string, unknown>;

// Evaluates the small Prisma where-subset the sweep uses (equality, `in`, `lt`)
// against in-memory rows, so the tests assert which rows actually survive
// rather than the shape of the query.
function matches(row: Row, where: Record<string, any>): boolean {
    return Object.entries(where).every(([field, condition]) => {
        const value = row[field];
        if (condition !== null && typeof condition === "object" && !(condition instanceof Date)) {
            if ("in" in condition) return condition.in.includes(value);
            if ("lt" in condition) return value instanceof Date && value < condition.lt;
            throw new Error(`Unsupported where operator on ${field}: ${JSON.stringify(condition)}`);
        }
        return value === condition;
    });
}

function fakeTable(initialRows: Row[]) {
    let rows = [...initialRows];
    return {
        ids: () => rows.map((row) => row.id).sort(),
        count: vi.fn(async ({ where }) => rows.filter((row) => matches(row, where)).length),
        findMany: vi.fn(async ({ where, take }) =>
            rows.filter((row) => matches(row, where)).slice(0, take).map((row) => ({ id: row.id }))
        ),
        deleteMany: vi.fn(async ({ where }) => {
            const before = rows.length;
            rows = rows.filter((row) => !matches(row, where));
            return { count: before - rows.length };
        }),
    };
}

function seedTables() {
    mockPrisma.job = fakeTable([
        { id: "job-queued-old", status: "queued", completedAt: null },
        { id: "job-pending-old", status: "pending", completedAt: null },
        { id: "job-running-old", status: "running", completedAt: null },
        // Requeued without clearing completedAt (e.g. by hand): status must still protect it.
        { id: "job-requeued-stale-completedAt", status: "queued", completedAt: daysAgo(200) },
        { id: "job-succeeded-old", status: "succeeded", completedAt: daysAgo(120) },
        { id: "job-dead-old", status: "dead_lettered", completedAt: daysAgo(120) },
        { id: "job-succeeded-recent", status: "succeeded", completedAt: daysAgo(10) },
        { id: "job-succeeded-no-completedAt", status: "succeeded", completedAt: null },
    ]);
    mockPrisma.outboxEvent = fakeTable([
        { id: "outbox-relayed-old", status: "RELAYED", createdAt: daysAgo(60) },
        { id: "outbox-relayed-recent", status: "RELAYED", createdAt: daysAgo(5) },
        { id: "outbox-pending-old", status: "PENDING", createdAt: daysAgo(60) },
        { id: "outbox-processing-old", status: "PROCESSING", createdAt: daysAgo(60) },
        { id: "outbox-failed-old", status: "FAILED", createdAt: daysAgo(60) },
    ]);
    mockPrisma.notification = fakeTable([
        { id: "notif-read-old", read: true, createdAt: daysAgo(120) },
        { id: "notif-unread-old", read: false, createdAt: daysAgo(400) },
        { id: "notif-read-recent", read: true, createdAt: daysAgo(10) },
    ]);
    for (const model of ["lLMUsageLog", "emailEvent", "landingEvent"]) {
        mockPrisma[model] = fakeTable([
            { id: `${model}-old`, createdAt: daysAgo(400) },
            { id: `${model}-recent`, createdAt: daysAgo(300) },
        ]);
    }
    // Present so any accidental access would show up; retention must never touch them.
    mockPrisma.activity = fakeTable([{ id: "activity-ancient", createdAt: daysAgo(3000) }]);
    mockPrisma.auditLog = fakeTable([{ id: "audit-ancient", createdAt: daysAgo(3000) }]);
}

const RETENTION_ENV_VARS = ["RETENTION_ENABLED", ...RETENTION_TARGETS.map((target) => target.envVar)];

describe("runRetentionSweep", () => {
    beforeEach(() => {
        for (const name of RETENTION_ENV_VARS) vi.stubEnv(name, undefined as unknown as string);
        seedTables();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe("safe by default", () => {
        it.each([
            ["unset", undefined],
            ["false", "false"],
            ["TRUE", "TRUE"],
            ["1", "1"],
        ])("RETENTION_ENABLED=%s is a dry run: counts only, deletes nothing", async (_label, value) => {
            if (value !== undefined) vi.stubEnv("RETENTION_ENABLED", value);

            const results = await runRetentionSweep(NOW);

            for (const model of ["job", "outboxEvent", "notification", "lLMUsageLog", "emailEvent", "landingEvent"]) {
                expect(mockPrisma[model].deleteMany).not.toHaveBeenCalled();
                expect(mockPrisma[model].findMany).not.toHaveBeenCalled();
            }
            expect(mockPrisma.job.ids()).toHaveLength(8);
            expect(results.every((result) => result.mode === "dry-run")).toBe(true);
            expect(Object.fromEntries(results.map((result) => [result.table, result.count]))).toEqual({
                Job: 2,
                OutboxEvent: 1,
                Notification: 1,
                LLMUsageLog: 1,
                EmailEvent: 1,
                LandingEvent: 1,
            });
        });
    });

    describe("with RETENTION_ENABLED=true", () => {
        beforeEach(() => {
            vi.stubEnv("RETENTION_ENABLED", "true");
        });

        it("deletes only finished Jobs past the window; queued, pending, running and recent jobs survive", async () => {
            await runRetentionSweep(NOW);

            expect(mockPrisma.job.ids()).toEqual([
                "job-pending-old",
                "job-queued-old",
                "job-requeued-stale-completedAt",
                "job-running-old",
                "job-succeeded-no-completedAt",
                "job-succeeded-recent",
            ]);
        });

        it("deletes only RELAYED OutboxEvents; PENDING, PROCESSING and FAILED survive", async () => {
            await runRetentionSweep(NOW);

            expect(mockPrisma.outboxEvent.ids()).toEqual([
                "outbox-failed-old",
                "outbox-pending-old",
                "outbox-processing-old",
                "outbox-relayed-recent",
            ]);
        });

        it("deletes only read Notifications; unread ones survive however old", async () => {
            await runRetentionSweep(NOW);

            expect(mockPrisma.notification.ids()).toEqual(["notif-read-recent", "notif-unread-old"]);
        });

        it("keeps a year of LLMUsageLog, EmailEvent and LandingEvent rows by default", async () => {
            await runRetentionSweep(NOW);

            for (const model of ["lLMUsageLog", "emailEvent", "landingEvent"]) {
                expect(mockPrisma[model].ids()).toEqual([`${model}-recent`]);
            }
        });

        it("never reads or deletes Activity or AuditLog", async () => {
            await runRetentionSweep(NOW);

            for (const model of ["activity", "auditLog"]) {
                expect(mockPrisma[model].count).not.toHaveBeenCalled();
                expect(mockPrisma[model].findMany).not.toHaveBeenCalled();
                expect(mockPrisma[model].deleteMany).not.toHaveBeenCalled();
            }
            const tables = RETENTION_TARGETS.map((target) => target.table);
            expect(tables).not.toContain("Activity");
            expect(tables).not.toContain("AuditLog");
        });

        it("re-applies the eligibility predicate on every delete, not just the selected ids", async () => {
            await runRetentionSweep(NOW);

            const [{ where }] = mockPrisma.job.deleteMany.mock.calls[0];
            expect(where).toMatchObject({
                status: { in: ["succeeded", "dead_lettered"] },
                completedAt: { lt: daysAgo(90) },
                id: { in: ["job-succeeded-old", "job-dead-old"] },
            });
        });

        it("honors a per-table window from env, and ignores invalid values", async () => {
            vi.stubEnv("RETENTION_JOB_DAYS", "7");
            vi.stubEnv("RETENTION_NOTIFICATION_DAYS", "0");
            vi.stubEnv("RETENTION_EMAIL_EVENT_DAYS", "abc");

            const results = await runRetentionSweep(NOW);

            expect(mockPrisma.job.ids()).not.toContain("job-succeeded-recent");
            expect(mockPrisma.notification.ids()).toContain("notif-read-recent");
            expect(mockPrisma.emailEvent.ids()).toEqual(["emailEvent-recent"]);
            const days = Object.fromEntries(results.map((result) => [result.table, result.days]));
            expect(days).toMatchObject({ Job: 7, Notification: 90, EmailEvent: 365 });
        });

        it("deletes in bounded batches and stops at the per-tick cap", async () => {
            const cap = RETENTION_BATCH_SIZE * RETENTION_MAX_BATCHES_PER_TABLE;
            mockPrisma.lLMUsageLog = fakeTable(
                Array.from({ length: cap + 5 }, (_, index) => ({ id: `log-${index}`, createdAt: daysAgo(400) }))
            );

            const results = await runRetentionSweep(NOW);

            expect(mockPrisma.lLMUsageLog.deleteMany).toHaveBeenCalledTimes(RETENTION_MAX_BATCHES_PER_TABLE);
            for (const [args] of mockPrisma.lLMUsageLog.findMany.mock.calls) {
                expect(args.take).toBe(RETENTION_BATCH_SIZE);
            }
            expect(mockPrisma.lLMUsageLog.ids()).toHaveLength(5);
            expect(results.find((result) => result.table === "LLMUsageLog")?.count).toBe(cap);
        });

        it("a failing table is reported and skipped; the others still run and the sweep does not throw", async () => {
            mockPrisma.job.findMany.mockRejectedValueOnce(new Error("connection reset"));

            const results = await runRetentionSweep(NOW);

            expect(results.find((result) => result.table === "Job")).toMatchObject({ count: 0, error: "connection reset" });
            expect(results).toHaveLength(RETENTION_TARGETS.length);
            expect(mockPrisma.lLMUsageLog.ids()).toEqual(["lLMUsageLog-recent"]);
        });
    });
});
