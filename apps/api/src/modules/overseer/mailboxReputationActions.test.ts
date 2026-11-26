import { beforeEach, describe, expect, it, vi, beforeAll, afterAll, afterEach } from "vitest";

// These tests cover the guarded behavior, which is off unless the flag is set.
beforeEach(() => { vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true"); });
afterEach(() => { vi.unstubAllEnvs(); });
import { actOnMailboxReputation, KEEP_SENDING_TEXT, progressMailboxSwitches, registrableDomain } from "./mailboxReputationActions";

const { db, dns, notify } = vi.hoisted(() => {
    const table = () => ({ findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() });
    const db = {
        connectedMailbox: table(), mailboxHealthSnapshot: table(), overseerNudge: table(), campaign: table(),
        campaignSequence: table(), sequenceStepRun: table(), sequenceEnrollment: table(),
        auditLog: { create: vi.fn() }, activity: { create: vi.fn() },
        $queryRaw: vi.fn(), $executeRaw: vi.fn(), $transaction: vi.fn(),
    };
    return { db, dns: vi.fn(), notify: vi.fn() };
});
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/modules/email-campaigner/service/domainAuthService", () => ({
    checkDomainDeliverabilitySignals: dns, dkimSelectorFromMetadata: vi.fn(),
}));
vi.mock("./domainWatch", () => ({ DOMAIN_NUDGE_TYPE: "DOMAIN_HEALTH", notifyOwners: notify }));

const now = new Date("2026-11-25T08:00:00.000Z");
const day = 86_400_000;
const pausedAt = new Date(now.getTime() - 2 * day).toISOString();
const greenPlacement = {
    runId: "probe", status: "done", requestedBy: "admin", startedAt: now.toISOString(), checkedAt: now.toISOString(),
    results: [{ provider: "gmail", folder: "inbox" }, { provider: "yahoo", folder: "inbox" }],
};
const candidate = {
    id: "replacement", teamId: "team", email: "send@another.test", status: "CONNECTED",
    isWarmingUp: false, warmupDay: 30, warmupTargetDays: 30, metadata: { placement: greenPlacement },
};
const reputationWrites = () => db.$executeRaw.mock.calls
    .filter(([sql]) => Array.isArray(sql) && sql.join(" ").includes("'{reputation}'"))
    .map(([, patch]) => JSON.parse(patch));
function old(replacement: object = { id: candidate.id }, level = "CRITICAL") {
    return { ...candidate, id: "old", email: "send@original.test", metadata: { reputation: {
        state: "HELD", level, replacement, incidentId: "incident",
        sendingHold: { since: pausedAt, reason: "complaints" },
        campaigns: [{ id: "campaign", pausedAt, status: "active", pausedBy: "reputation_guard" }],
        sequences: [{ id: "sequence", pausedAt, status: "ACTIVE", pausedBy: "reputation_guard" }],
    } } };
}
function prepare(mailbox = old(), next: Omit<typeof candidate, "metadata"> & { metadata: unknown } = candidate) {
    db.connectedMailbox.findMany.mockResolvedValue([mailbox]);
    db.connectedMailbox.findFirst.mockImplementation(async ({ where }) => where.id === "old" ? mailbox : next);
}

describe("mailbox replacement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        db.$transaction.mockImplementation(async (work) => work(db));
        db.overseerNudge.findFirst.mockResolvedValue(null);
        dns.mockResolvedValue({ spf: true, dkim: true, dmarc: true });
        db.mailboxHealthSnapshot.findFirst.mockResolvedValue({ status: "OK", checkedAt: now });
        db.campaign.findFirst.mockResolvedValue({ aiConfig: {} });
        db.campaign.findMany.mockResolvedValue([]);
        db.campaign.updateMany.mockResolvedValue({ count: 1 });
        db.campaignSequence.findFirst.mockResolvedValue({ id: "sequence", senderMailboxIds: ["old", "another"] });
        db.campaignSequence.updateMany.mockResolvedValue({ count: 1 });
    });

    it("distinguishes registered domains, including wildcard and exception suffixes", () => {
        const rules = new Set(["co.uk", "*.kawasaki.jp", "!city.kawasaki.jp"]);
        expect(registrableDomain("rep@send.company.co.uk", rules)).toBe(registrableDomain("reply@company.co.uk", rules));
        expect(registrableDomain("rep@send.other.co.uk", rules)).not.toBe(registrableDomain("reply@company.co.uk", rules));
        expect(registrableDomain("rep@send.city.kawasaki.jp", rules)).toBe("city.kawasaki.jp");
        expect(registrableDomain("rep@send.company.kawasaki.jp", rules)).toBe("send.company.kawasaki.jp");
    });

    it("refuses the keep-sending action at critical even with confirmed text", async () => {
        prepare();
        await expect(actOnMailboxReputation("team", "old", "admin", { action: "keep", confirmation: KEEP_SENDING_TEXT }, now))
            .rejects.toMatchObject({ code: "WARNING_CONFIRMATION_REQUIRED" });
        expect(db.auditLog.create).not.toHaveBeenCalled();
    });

    it("waits when DNS fails or the replacement is still warming", async () => {
        prepare(old(), { ...candidate, isWarmingUp: true, warmupDay: 4 });
        dns.mockResolvedValueOnce({ spf: false, dkim: true, dmarc: true });
        await progressMailboxSwitches(now);
        expect(reputationWrites()[0]?.state).toBe("SWITCH_PENDING");
        await progressMailboxSwitches(now);
        expect(reputationWrites().at(-1)?.state).toBe("WARMING");
        expect(notify).not.toHaveBeenCalled();
    });

    it("lets only activity-based warmup graduate a replacement at its target", async () => {
        prepare(old(), { ...candidate, isWarmingUp: true });
        await progressMailboxSwitches(now);
        expect(reputationWrites().at(-1)).toMatchObject({ state: "WARMING" });
        expect(db.connectedMailbox.update).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
    });

    it.each([
        ["missing", undefined],
        ["invalid", { ...greenPlacement, checkedAt: "invalid date" }],
        ["stale", { ...greenPlacement, checkedAt: new Date(now.getTime() - 15 * day).toISOString() }],
        ["red", { ...greenPlacement, results: [{ provider: "gmail", folder: "spam" }] }],
        ["accepted red", { ...greenPlacement, results: [{ provider: "gmail", folder: "spam" }], override: { by: "admin", at: now.toISOString() } }],
    ])("requires current green placement before scheduling a switch (%s)", async (_name, placement) => {
        prepare(old(), { ...candidate, metadata: { placement } });
        await progressMailboxSwitches(now);
        expect(reputationWrites().at(-1)).toMatchObject({ state: "WARMING" });
        expect(notify).not.toHaveBeenCalled();
    });

    it("rechecks placement at switch time and clears the notice if the result became red", async () => {
        prepare(old({ id: candidate.id, readyAt: now.toISOString() }), {
            ...candidate, metadata: { placement: { ...greenPlacement, results: [{ provider: "yahoo", folder: "spam" }] } },
        });
        await progressMailboxSwitches(now);
        expect(reputationWrites().at(-1)).toMatchObject({ state: "WARMING" });
        expect(reputationWrites().at(-1)?.replacement.readyAt).toBeUndefined();
        expect(db.sequenceEnrollment.updateMany).not.toHaveBeenCalled();
        expect(notify).not.toHaveBeenCalled();
    });

    it("updates only the reputation key and merges its patch against the row in the database", async () => {
        prepare();
        await progressMailboxSwitches(now);
        const [sql, patch, mailboxId, teamId] = db.$executeRaw.mock.calls[0] ?? [];
        expect(sql.join(" ")).toContain("jsonb_set");
        expect(sql.join(" ")).toContain("THEN \"metadata\"->'reputation' ELSE '{}'::jsonb END ||");
        expect(JSON.parse(patch)).toMatchObject({ state: "SWITCH_SCHEDULED" });
        expect({ mailboxId, teamId }).toEqual({ mailboxId: "old", teamId: "team" });
        expect(db.connectedMailbox.update).not.toHaveBeenCalled();
    });

    it("restarts the replacement wait and sends a warning when the latest check is unhealthy", async () => {
        prepare();
        db.mailboxHealthSnapshot.findFirst.mockResolvedValueOnce({ status: "WARNING", checkedAt: now });
        await progressMailboxSwitches(now);
        expect(reputationWrites().at(-1)?.replacement.awaitingFreshHealthAfter).toBe(now.toISOString());
        expect(notify).toHaveBeenCalledOnce();
    });

    it("sends the 24-hour notice before changing any sender", async () => {
        prepare();
        await progressMailboxSwitches(now);
        expect(reputationWrites().at(-1)?.replacement.readyAt)
            .toBe(new Date(now.getTime() + day).toISOString());
        expect(notify).toHaveBeenCalledWith("team", expect.stringContaining("Your campaigns resume"), expect.any(String), expect.objectContaining({ action: "Delay" }));
        expect(db.sequenceEnrollment.updateMany).not.toHaveBeenCalled();
    });

    it("only resumes matching pauses, preserves enrollment positions, and sets the new default", async () => {
        prepare(old({ id: candidate.id, readyAt: now.toISOString() }));
        await progressMailboxSwitches(now);
        expect(db.campaignSequence.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "sequence", teamId: "team", status: "PAUSED", updatedAt: new Date(pausedAt) },
            data: { status: "ACTIVE", senderMailboxIds: ["replacement", "another"] },
        }));
        expect(db.sequenceEnrollment.updateMany).toHaveBeenCalledWith({
            where: { teamId: "team", sequenceId: "sequence", status: "ACTIVE", mailboxId: "old" },
            data: { mailboxId: "replacement" },
        });
        expect(db.$executeRaw).toHaveBeenCalledTimes(2);
        expect(reputationWrites().at(-1)).toMatchObject({ state: "RESOLVED" });
        expect(db.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ entity: "MailboxReputation", action: "SENDER_SWITCHED" }) }));
    });
});
