import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { db, send, enqueue } = vi.hoisted(() => ({
    enqueue: vi.fn(),
    db: {
        lead: { findUnique: vi.fn() },
        campaign: { findUnique: vi.fn() },
        suppressionEntry: { findUnique: vi.fn() },
        connectedMailbox: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
        email: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn() },
        campaignAttachment: { findMany: vi.fn() },
        team: { findUnique: vi.fn() },
        auditLog: { create: vi.fn() },
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
        vi.clearAllMocks();
        db.lead.findUnique.mockResolvedValue({ id: "l1", email: "sam@acme.example", fullName: "Sam" });
        db.campaign.findUnique.mockResolvedValue({ id: "c1", name: "Launch", teamId: "t1", variants: [] });
        db.suppressionEntry.findUnique.mockResolvedValue(null);
        db.connectedMailbox.findFirst.mockResolvedValue({ id: "m1", email: "me@x.test", dailyLimit: 50, isWarmingUp: false, warmupDay: 0, provider: "GOOGLE_WORKSPACE" });
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
        db.team.findUnique.mockRejectedValue(new Error("db"));
        await expect(handleEmailSending(failing)).rejects.toThrow("stop here");
        expect(send).toHaveBeenCalledTimes(1);
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
        db.connectedMailbox.findFirst.mockResolvedValue({ id: "m1", email: "me@x.test", dailyLimit: 50, isWarmingUp: false, warmupDay: 0, provider: "GOOGLE_WORKSPACE" });
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
        db.team.findUnique.mockRejectedValue(new Error("db"));
        await expect(handleEmailSending(payload)).rejects.toThrow("stop here");
        expect(enqueue).not.toHaveBeenCalled();
    });
});
