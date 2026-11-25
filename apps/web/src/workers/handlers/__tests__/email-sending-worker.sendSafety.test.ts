import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, send, enqueue } = vi.hoisted(() => ({
    enqueue: vi.fn(),
    db: {
        lead: { findUnique: vi.fn() },
        campaign: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ consecutiveFailures: 1 }) },
        suppressionEntry: { findUnique: vi.fn() },
        connectedMailbox: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        email: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn().mockResolvedValue(350) },
        campaignAttachment: { findMany: vi.fn() },
        team: { findUnique: vi.fn() },
        auditLog: { create: vi.fn() },
        consentLedger: { findMany: vi.fn() },
        $executeRaw: vi.fn(),
    },
    send: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue } }));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({ advanceLeadAfterEmailSent: vi.fn() }));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({ sendViaGmailMailbox: vi.fn() }));
vi.mock("@/lib/email/linkTracking", () => ({ rewriteLinksForTracking: async (b: string) => b, buildOpenPixelHtml: () => "" }));
vi.mock("@/lib/email/unsubscribeHeaders", () => ({ buildUnsubscribeHeaders: () => ({}), appendUnsubscribeFooter: (h: string) => h }));
vi.mock("@/modules/email-campaigner/providers", () => ({ MailProviderFactory: { getProvider: () => ({ send }) } }));

import { handleEmailSending } from "../email-sending-worker";

const payload = { leadId: "l1", campaignId: "c1", teamId: "t1", subject: "Quick question", body: "<p>Hi Sam, about your support team.</p>" };
const failing = { ...payload, body: "<p>Act now, a risk-free offer.</p>" };

describe("email_sending pre-send gate", () => {
    beforeEach(() => {
        vi.stubEnv("MAILBOX_REPUTATION_GUARD", "true");
        vi.clearAllMocks();
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam" });
        db.campaign.findUnique.mockResolvedValue({ id: "c1", name: "Launch", teamId: "t1", variants: [] });
        db.suppressionEntry.findUnique.mockResolvedValue(null);
        db.connectedMailbox.findFirst.mockResolvedValue({ id: "m1", status: "CONNECTED", email: "me@x.test", dailyLimit: 50, isWarmingUp: false, warmupDay: 0, provider: "GOOGLE_WORKSPACE" });
        db.$executeRaw.mockResolvedValue(1);
        db.email.findFirst.mockResolvedValue(null);
        db.email.create.mockResolvedValue({ id: "e1", trackingId: "tr1" });
        db.email.update.mockResolvedValue({ id: "e1" });
        db.campaignAttachment.findMany.mockResolvedValue([]);
        db.team.findUnique.mockResolvedValue({ sendSafety: { mode: "hold" }, mailingAddress: "1 Main St" });
        send.mockRejectedValue(new Error("stop here"));
    });

    it("sends a healthy email through to the provider", async () => {
        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
        expect(db.auditLog.create).not.toHaveBeenCalled();
    });

    it("refuses a disconnected explicit mailbox before reserving a slot", async () => {
        db.connectedMailbox.findFirst.mockResolvedValueOnce({ id: "m1", status: "DISCONNECTED" });
        await expect(handleEmailSending({ ...payload, mailboxId: "m1" })).rejects.toThrow("No connected mailbox");
        expect(db.$executeRaw).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it("ignores a stored reputation hold while the guard flag is off", async () => {
        vi.unstubAllEnvs();
        db.connectedMailbox.findFirst.mockResolvedValueOnce({
            id: "m1", status: "CONNECTED", email: "me@x.test", dailyLimit: 50, isWarmingUp: false, warmupDay: 0, provider: "GOOGLE_WORKSPACE",
            metadata: { reputation: { sendingHold: { reason: "complaints" } } },
        });
        // It gets past the hold and reaches the (mocked) send, which throws.
        await expect(handleEmailSending({ ...payload, mailboxId: "m1" })).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalled();
    });

    it("blocks an explicit mailbox on a reputation hold", async () => {
        db.connectedMailbox.findFirst.mockResolvedValueOnce({
            id: "m1", status: "CONNECTED", metadata: { reputation: { sendingHold: { reason: "complaints" } } },
        });
        await expect(handleEmailSending({ ...payload, mailboxId: "m1" })).resolves.toEqual({ skipped: true, reason: "MAILBOX_REPUTATION_HOLD" });
        expect(db.$executeRaw).not.toHaveBeenCalled();
        expect(send).not.toHaveBeenCalled();
    });

    it("reports GROWTH_CAP when the atomic slot claim is at the growth limit", async () => {
        const mailbox = { id: "m1", status: "CONNECTED", email: "me@x.test", dailyLimit: 200, isWarmingUp: false, warmupDay: 4, provider: "GOOGLE_WORKSPACE", metadata: { reputation: { state: "OPEN" } } };
        db.connectedMailbox.findFirst.mockResolvedValueOnce(mailbox);
        db.connectedMailbox.findUnique.mockResolvedValueOnce({ ...mailbox, sentTodayDate: new Date(), sentToday: 30 });
        db.email.count.mockResolvedValueOnce(140);
        db.$executeRaw.mockResolvedValueOnce(0);
        await expect(handleEmailSending(payload)).resolves.toEqual({ skipped: true, reason: "GROWTH_CAP" });
        expect(send).not.toHaveBeenCalled();
    });

    it("in hold mode stops a failing email before anything is created or sent, and gives the daily slot back", async () => {
        const result = await handleEmailSending(failing);

        expect(result).toEqual({ skipped: true, reason: "held_by_send_safety", codes: ["BANNED_PHRASE"] });
        expect(send).not.toHaveBeenCalled();
        expect(db.email.create).not.toHaveBeenCalled();
        expect(db.$executeRaw).toHaveBeenCalledTimes(2); // take a slot, give it back
        // The give-back only applies to the day the slot was taken, so a midnight rollover cannot undercount the new day.
        expect((db.$executeRaw.mock.calls[1]![0] as string[]).join("?")).toContain('"sentTodayDate" =');
        const audit = db.auditLog.create.mock.calls[0]![0].data;
        expect(audit).toMatchObject({ action: "SEND_SAFETY_HELD", entityId: "l1", metadata: { campaignId: "c1", codes: ["BANNED_PHRASE"] } });
        expect(JSON.stringify(audit)).not.toContain("risk-free");
    });

    it("in warn mode sends anyway", async () => {
        db.team.findUnique.mockResolvedValue({ sendSafety: { mode: "warn" }, mailingAddress: "1 Main St" });
        await expect(handleEmailSending(failing)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("in off mode does not check", async () => {
        db.team.findUnique.mockResolvedValue({ sendSafety: { mode: "off" }, mailingAddress: null });
        await expect(handleEmailSending(failing)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("sends when the team settings cannot be read", async () => {
        // The first read is the DPDP gate's, which fails closed when it cannot read (see the DPDP block below); this test is about the later pre-send read.
        db.team.findUnique.mockResolvedValueOnce({ sendSafety: null }).mockRejectedValue(new Error("db"));
        await expect(handleEmailSending(failing)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
    });

    describe("email status", () => {
        const withStatus = (emailStatus: string) => db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", emailStatus });

        it("in hold mode holds a cold send to an unverified address", async () => {
            withStatus("UNKNOWN");
            expect(await handleEmailSending(payload)).toEqual({ skipped: true, reason: "held_by_send_safety", codes: ["EMAIL_NOT_VERIFIED"] });
            expect(send).not.toHaveBeenCalled();
        });

        it("in hold mode sends to a verified address", async () => {
            withStatus("VERIFIED");
            await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        });

        it("in warn mode still sends to an unverified address", async () => {
            db.team.findUnique.mockResolvedValue({ sendSafety: { mode: "warn" }, mailingAddress: "1 Main St" });
            withStatus("UNKNOWN");
            await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        });

        it("in warn mode never sends to an address known to be undeliverable", async () => {
            db.team.findUnique.mockResolvedValue({ sendSafety: { mode: "warn" }, mailingAddress: "1 Main St" });
            withStatus("INVALID");
            expect(await handleEmailSending(payload)).toEqual({ skipped: true, reason: "held_by_send_safety", codes: ["EMAIL_INVALID"] });
            expect(send).not.toHaveBeenCalled();
        });
    });
});

describe("email_sending recipient send window", () => {
    const windowOn = { sendSafety: { mode: "off", sendWindow: { enabled: true } }, mailingAddress: null };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-09-30T10:00:00Z")); // Wed: 15:30 in Kolkata, 19:00 in Tokyo
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", location: "Pune, India" });
        db.campaign.findUnique.mockResolvedValue({ id: "c1", name: "Launch", teamId: "t1", variants: [] });
        db.suppressionEntry.findUnique.mockResolvedValue(null);
        db.connectedMailbox.findFirst.mockResolvedValue({ id: "m1", status: "CONNECTED", email: "me@x.test", dailyLimit: 50, isWarmingUp: false, warmupDay: 0, provider: "GOOGLE_WORKSPACE" });
        db.$executeRaw.mockResolvedValue(1);
        db.email.findFirst.mockResolvedValue(null);
        db.email.create.mockResolvedValue({ id: "e1", trackingId: "tr1" });
        db.email.update.mockResolvedValue({ id: "e1" });
        db.campaignAttachment.findMany.mockResolvedValue([]);
        db.team.findUnique.mockResolvedValue(windowOn);
        enqueue.mockResolvedValue({ id: "j2" });
        send.mockRejectedValue(new Error("stop here"));
    });
    afterEach(() => vi.useRealTimers());

    it("sends inside the recipient's window", async () => {
        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(enqueue).not.toHaveBeenCalled();
    });

    it("outside the window queues the same job for the next window start, before using a daily slot", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", location: "Tokyo, Japan" });
        const result = await handleEmailSending(payload);

        expect(result).toMatchObject({ skipped: true, reason: "outside_send_window" });
        expect(send).not.toHaveBeenCalled();
        expect(db.$executeRaw).not.toHaveBeenCalled();
        const [type, queued, options] = enqueue.mock.calls[0]!;
        expect(type).toBe("email_sending");
        expect(queued).toEqual(payload);
        // Thu 08:00 Tokyo = Wed 23:00Z, plus under 90 minutes of jitter
        expect(options.processAt.getTime()).toBeGreaterThanOrEqual(new Date("2026-09-30T23:00:00Z").getTime());
        expect(options.processAt.getTime()).toBeLessThan(new Date("2026-10-01T00:30:00Z").getTime());
        expect(options.idempotencyKey).toContain("l1_c1");
    });

    it("treats a duplicate-key insert as already queued, and does not send now", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", location: "Tokyo, Japan" });
        enqueue.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));
        const result = await handleEmailSending(payload);
        expect(result).toMatchObject({ skipped: true, reason: "outside_send_window" });
        expect(send).not.toHaveBeenCalled();
    });

    it("fails the job, rather than sending out of window, when the delayed job cannot be queued", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", location: "Tokyo, Japan" });
        enqueue.mockRejectedValue(new Error("queue down"));
        await expect(handleEmailSending(payload)).rejects.toThrow("queue down");
        expect(send).not.toHaveBeenCalled();
    });

    it("does nothing unless the team turns it on", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", location: "Tokyo, Japan" });
        db.team.findUnique.mockResolvedValue({ sendSafety: null, mailingAddress: null });
        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(enqueue).not.toHaveBeenCalled();
    });

    it("sends when the team settings cannot be read", async () => {
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam", location: "Tokyo, Japan" });
        // The first read is the DPDP gate's (fails closed when unreadable); this test is about the later send-window read.
        db.team.findUnique.mockResolvedValueOnce({ sendSafety: null }).mockRejectedValue(new Error("db"));
        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(enqueue).not.toHaveBeenCalled();
    });
});

describe("email_sending DPDP send gate", () => {
    const gateOn = { sendSafety: { DPDP_SEND_GATE: true }, mailingAddress: "1 Main St" };

    beforeEach(() => {
        vi.clearAllMocks();
        db.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "sam@acme.example", fullName: "Sam", lawfulBasis: "NONE", sourceUrl: null, publishedBySubject: false });
        db.campaign.findUnique.mockResolvedValue({ id: "c1", name: "Launch", teamId: "t1", variants: [] });
        db.suppressionEntry.findUnique.mockResolvedValue(null);
        db.connectedMailbox.findFirst.mockResolvedValue({ id: "m1", status: "CONNECTED", email: "me@x.test", dailyLimit: 50, isWarmingUp: false, warmupDay: 0, provider: "GOOGLE_WORKSPACE" });
        db.$executeRaw.mockResolvedValue(1);
        db.email.findFirst.mockResolvedValue(null);
        db.email.create.mockResolvedValue({ id: "e1", trackingId: "tr1" });
        db.email.update.mockResolvedValue({ id: "e1" });
        db.campaignAttachment.findMany.mockResolvedValue([]);
        db.consentLedger.findMany.mockResolvedValue([]);
        db.team.findUnique.mockResolvedValue(gateOn);
        send.mockRejectedValue(new Error("stop here"));
    });

    it("skips a lead with no consent or public source, with the reason, before anything is created or sent", async () => {
        const result = await handleEmailSending(payload);

        expect(result).toEqual({ skipped: true, reason: "No consent or proven public source", code: "no_lawful_basis" });
        expect(send).not.toHaveBeenCalled();
        expect(db.email.create).not.toHaveBeenCalled();
        expect(db.$executeRaw).not.toHaveBeenCalled();
    });

    it("skips a lead whose consent was revoked", async () => {
        const granted = { channel: "EMAIL", status: "GRANTED", revokedAt: null, grantedAt: new Date(1), purpose: "MARKETING_AND_SUPPORT" };
        const revoked = { channel: "EMAIL", status: "REVOKED", revokedAt: null, grantedAt: new Date(2), purpose: "REVOCATION" };
        db.consentLedger.findMany.mockResolvedValue([granted, revoked]);

        expect(await handleEmailSending(payload)).toMatchObject({ skipped: true, code: "no_lawful_basis" });
        expect(send).not.toHaveBeenCalled();
    });

    it("sends a lead with granted email consent", async () => {
        db.consentLedger.findMany.mockResolvedValue([{ channel: "EMAIL", status: "GRANTED", revokedAt: null, grantedAt: new Date(1), purpose: "MARKETING_AND_SUPPORT" }]);

        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
    });

    it("with the flag off, sends exactly as before and reads no consent", async () => {
        db.team.findUnique.mockResolvedValue({ sendSafety: null, mailingAddress: "1 Main St" });

        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
        expect(db.consentLedger.findMany).not.toHaveBeenCalled();
    });
});

describe("email_sending DPDP send gate when the team setting cannot be read", () => {
    it("fails closed: the job errors instead of sending unchecked", async () => {
        vi.clearAllMocks();
        db.lead.findUnique.mockResolvedValue({ id: "l1", teamId: "t1", email: "sam@acme.example", fullName: "Sam" });
        db.campaign.findUnique.mockResolvedValue({ id: "c1", name: "Launch", teamId: "t1", variants: [] });
        db.suppressionEntry.findUnique.mockResolvedValue(null);
        db.team.findUnique.mockRejectedValue(new Error("db"));

        await expect(handleEmailSending(payload)).rejects.toThrow("db");
        expect(send).not.toHaveBeenCalled();
    });
});
