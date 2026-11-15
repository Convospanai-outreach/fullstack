import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, send } = vi.hoisted(() => ({
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
