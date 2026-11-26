import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mailboxSendLimit } from "../../../../../../packages/db/mailboxQuota";
import { advanceMailboxWarmup, listConnectedMailboxes } from "./googleMailboxService";

const { db, notify } = vi.hoisted(() => ({
    db: {
        connectedMailbox: { findMany: vi.fn(), updateMany: vi.fn() },
        email: { count: vi.fn(), findFirst: vi.fn() },
        emailEvent: { findFirst: vi.fn() },
        mailboxHealthSnapshot: { findFirst: vi.fn() },
        warmupSeedMailbox: { findFirst: vi.fn() },
        $executeRaw: vi.fn(),
    },
    notify: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/modules/overseer/domainWatch", () => ({ notifyOwners: notify }));

const now = new Date("2026-11-25T10:00:00Z");
const midnight = new Date("2026-11-25T00:00:00Z");
const yesterday = new Date("2026-11-24T10:00:00Z");
const mailbox = {
    id: "m1", teamId: "t1", email: "sender@example.test", provider: "RESEND", dailyLimit: 100,
    isWarmingUp: true, warmupDay: 1, warmupTargetDays: 4, warmupLastAdvancedAt: null,
    createdAt: new Date("2026-10-01T00:00:00Z"), updatedAt: yesterday,
    metadata: { inboundDomain: "in.example.test", placement: { status: "running" }, reputation: { level: "OK" } },
};
function feedback(sent: number, bounces = 0, complaints = 0) {
    db.email.count.mockResolvedValueOnce(sent).mockResolvedValueOnce(bounces).mockResolvedValueOnce(complaints);
}

function latestWrite() {
    const [sql, state, warmupDay, isWarmingUp] = db.$executeRaw.mock.calls.at(-1) ?? [];
    return { sql: sql.join(" "), state: JSON.parse(state), warmupDay, isWarmingUp };
}

describe("activity-based mailbox warmup", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true");
        vi.stubEnv("WARMUP_SEED_EXCHANGE", undefined);
        db.connectedMailbox.findMany.mockResolvedValue([mailbox]);
        db.email.findFirst.mockResolvedValue({ createdAt: yesterday });
        db.emailEvent.findFirst.mockResolvedValue(null);
        db.$executeRaw.mockResolvedValue(1);
        notify.mockResolvedValue(undefined);
    });
    afterEach(() => vi.unstubAllEnvs());

    it("holds the rung when no real sends are attributed to the previous day", async () => {
        feedback(0);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 0 });
        expect(latestWrite()).toMatchObject({
            state: { evaluatedDay: midnight.toISOString(), holdReason: "low_volume" }, warmupDay: 1, isWarmingUp: true,
        });
        expect(db.email.count).toHaveBeenCalledWith({ where: {
            mailboxId: "m1", OR: expect.arrayContaining([{
                events: { some: { type: "SENT", createdAt: {
                    gte: new Date("2026-11-24T00:00:00Z"), lt: midnight,
                } } },
            }]),
        } });
        expect(db.connectedMailbox.updateMany).not.toHaveBeenCalled();
    });

    it("advances only one rung on a day with enough real sends", async () => {
        feedback(3);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        expect(latestWrite()).toMatchObject({ state: { holdReason: null }, warmupDay: 2, isWarmingUp: true });
        expect(latestWrite().sql).toContain("'{warmup}'");
        expect(latestWrite().sql).toContain('AND "updatedAt" = ');
        expect(latestWrite().sql).toContain('AND COALESCE("metadata"->\'warmup\'');
        db.connectedMailbox.findMany.mockResolvedValue([{
            ...mailbox, warmupDay: 2, metadata: { ...mailbox.metadata, warmup: latestWrite().state },
        }]);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 0 });
        expect(db.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it.each([
        [24, 1, 0, "bounces"],
        [25, 0, 1, "complaints"],
    ])("holds for unsafe feedback with %s sends, %s bounces and %s complaints", async (sent, bounces, complaints, reason) => {
        feedback(sent, bounces, complaints);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 0 });
        expect(latestWrite()).toMatchObject({ state: { holdReason: reason }, warmupDay: 1 });
    });

    it("accepts a bounce rate of exactly four percent", async () => {
        feedback(25, 1);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        expect(latestWrite()).toMatchObject({ state: { holdReason: null }, warmupDay: 2 });
    });

    it("finishes at the configured target with a fresh healthy snapshot and notifies", async () => {
        db.connectedMailbox.findMany.mockResolvedValue([{ ...mailbox, warmupTargetDays: 2 }]);
        db.mailboxHealthSnapshot.findFirst.mockResolvedValue({ status: "OK", checkedAt: now });
        feedback(3);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        expect(latestWrite()).toMatchObject({ state: { holdReason: null }, warmupDay: 2, isWarmingUp: false });
        expect(notify).toHaveBeenCalledWith("t1", expect.stringContaining("finished warming up"), expect.any(String),
            expect.objectContaining({
                href: expect.stringMatching(/^https?:\/\/.+\/settings\/mailboxes$/),
                key: expect.stringContaining("finished:"),
            }));
    });

    it("keeps a previous calendar-ramp mailbox at target until recent real history and healthy reputation are available", async () => {
        db.connectedMailbox.findMany.mockResolvedValue([{ ...mailbox, warmupDay: 4 }]);
        db.mailboxHealthSnapshot.findFirst.mockResolvedValue({ status: "WARNING", checkedAt: now });
        feedback(0);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 0 });
        const prior = latestWrite().state;
        expect(prior).toMatchObject({ holdReason: "awaiting_health" });
        expect(notify).not.toHaveBeenCalled();
        db.connectedMailbox.findMany.mockResolvedValue([{ ...mailbox, warmupDay: 4, metadata: { ...mailbox.metadata, warmup: prior } }]);
        db.mailboxHealthSnapshot.findFirst.mockResolvedValue({ status: "OK", checkedAt: now });
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        expect(latestWrite()).toMatchObject({ warmupDay: 4, isWarmingUp: false });
    });

    it("rewinds once after 14 idle days, notifies once and makes the lower cap effective", async () => {
        const lastSend = new Date("2026-11-11T10:00:00Z");
        db.email.findFirst.mockResolvedValue({ createdAt: lastSend });
        db.connectedMailbox.findMany.mockResolvedValue([{ ...mailbox, isWarmingUp: false, warmupDay: 9 }]);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        const { state, warmupDay, isWarmingUp } = latestWrite();
        expect({ state, warmupDay, isWarmingUp }).toMatchObject({
            state: { idleAnchor: lastSend.toISOString() }, warmupDay: 2, isWarmingUp: true,
        });
        const history = vi.fn();
        await expect(mailboxSendLimit(history, { ...mailbox, warmupDay, isWarmingUp }, midnight))
            .resolves.toEqual({ limit: 15, growthLimited: false });
        expect(history).not.toHaveBeenCalled();
        db.connectedMailbox.findMany.mockResolvedValue([{ ...mailbox, warmupDay, isWarmingUp, metadata: { ...mailbox.metadata, warmup: state } }]);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 0 });
        expect(notify).toHaveBeenCalledTimes(1);
    });

    it("resets a long-idle mailbox to day zero and notifies only when the conditional update wins", async () => {
        db.email.findFirst.mockResolvedValue(null);
        db.connectedMailbox.findMany.mockResolvedValue([{ ...mailbox, warmupDay: 4 }]);
        db.$executeRaw.mockResolvedValueOnce(0);
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 0 });
        expect(notify).not.toHaveBeenCalled();
        await expect(advanceMailboxWarmup(now)).resolves.toEqual({ count: 1 });
        expect(latestWrite()).toMatchObject({ warmupDay: 0, isWarmingUp: true });
        expect(notify).toHaveBeenCalledOnce();
    });

    it("reports real sends only for Resend and for Gmail when the seed pool is empty", async () => {
        vi.stubEnv("WARMUP_SEED_EXCHANGE", "on");
        db.warmupSeedMailbox.findFirst.mockResolvedValue(null);
        db.connectedMailbox.findMany.mockResolvedValue([
            { ...mailbox, metadata: { warmup: { holdReason: "bounces" } } },
            { ...mailbox, id: "m2", provider: "GOOGLE_WORKSPACE" },
        ]);
        const mailboxes = await listConnectedMailboxes("t1");
        expect(mailboxes).toMatchObject([
            { warmupActivity: { realSendsOnly: true, holdReason: "bounces" } },
            { warmupActivity: { realSendsOnly: true, holdReason: null } },
        ]);
        db.warmupSeedMailbox.findFirst.mockResolvedValue({ id: "seed" });
        await expect(listConnectedMailboxes("t1")).resolves.toMatchObject([
            { warmupActivity: { realSendsOnly: true } },
            { warmupActivity: { realSendsOnly: false } },
        ]);
    });

    it("keeps the legacy mailbox-list response when the guard is off", async () => {
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", undefined);
        await expect(listConnectedMailboxes("t1")).resolves.toEqual([mailbox]);
        expect(db.warmupSeedMailbox.findFirst).not.toHaveBeenCalled();
    });
});
