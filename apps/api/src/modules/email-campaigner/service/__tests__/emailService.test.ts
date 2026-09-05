import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { emailService } from "../emailService";
import { prisma } from "@/lib/db";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { getSmtpConfig } from "../smtpConfigService";
import { isSuppressed, selectMailboxForSend, sendViaGmailMailbox } from "../googleMailboxService";

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        lead: { findUnique: vi.fn() },
        campaign: { findUnique: vi.fn() },
        email: { create: vi.fn() },
        team: { findUnique: vi.fn().mockResolvedValue({ mailingAddress: null }) },
    },
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/email/smtpClient", () => ({ sendViaSMTP: vi.fn() }));
vi.mock("../smtpConfigService", () => ({ getSmtpConfig: vi.fn() }));
vi.mock("../googleMailboxService", () => ({
    isSuppressed: vi.fn(),
    selectMailboxForSend: vi.fn(),
    sendViaGmailMailbox: vi.fn(),
    signTrackedUrl: vi.fn(() => "tracking-signature"),
}));

const metadata = {
    teamId: "team-1",
    userId: "user-1",
    leadId: "lead-1",
    campaignId: "campaign-1",
};

const smtpConfig = {
    host: "smtp.example.test",
    port: 587,
    secure: false,
    user: "smtp-user",
    password: "smtp-password",
    fromName: "Sender",
    fromEmail: "sender@example.test",
};

function gmailFailure(
    error: "GMAIL_SEND_PRE_DISPATCH_FAILED" | "GMAIL_SEND_REJECTED" | "GMAIL_SEND_TIMEOUT" | "GMAIL_SEND_FAILED" | "GMAIL_SEND_RESPONSE_INVALID",
    outcome: "PRE_DISPATCH_NO_SEND" | "EXPLICIT_REJECTION" | "AMBIGUOUS",
    fallbackAllowed: boolean,
) {
    return { success: false as const, error, outcome, fallbackAllowed };
}

function sentEmailData() {
    return (prisma.email.create as Mock).mock.calls[0][0].data;
}

describe("emailService Gmail fallback policy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (isSuppressed as Mock).mockResolvedValue(false);
        (prisma.lead.findUnique as Mock).mockResolvedValue(null);
        (prisma.campaign.findUnique as Mock).mockResolvedValue(null);
        (selectMailboxForSend as Mock).mockResolvedValue(null);
        (getSmtpConfig as Mock).mockResolvedValue(smtpConfig);
        (sendViaSMTP as Mock).mockResolvedValue({ success: true, messageId: "smtp-message-1" });
        (prisma.email.create as Mock).mockResolvedValue({ id: "email-1" });
    });

    it("persists a successful Gmail delivery and never loads SMTP", async () => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue({
            success: true,
            deliveryProvider: "GMAIL_API",
            mailboxId: "gmail-mailbox-1",
            messageId: "gmail-message-1",
            threadId: "gmail-thread-1",
        });

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: true, providerId: "gmail-message-1", deliveryProvider: "GMAIL_API" });

        expect(getSmtpConfig).not.toHaveBeenCalled();
        expect(sendViaSMTP).not.toHaveBeenCalled();
        expect(sentEmailData()).toEqual(expect.objectContaining({
            deliveryProvider: "GMAIL_API",
            mailboxId: "gmail-mailbox-1",
            providerId: "gmail-message-1",
            threadId: "gmail-thread-1",
        }));
    });

    it("uses SMTP as primary when no Gmail mailbox is selected", async () => {
        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: true, providerId: "smtp-message-1", deliveryProvider: "SMTP" });

        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
        expect(sendViaSMTP).toHaveBeenCalledTimes(1);
        expect(sentEmailData()).toEqual(expect.objectContaining({
            deliveryProvider: "SMTP",
            mailboxId: null,
            providerId: "smtp-message-1",
        }));
        expect(sentEmailData()).not.toHaveProperty("threadId");
    });

    it("uses SMTP once after a Gmail HTTP 400 explicit rejection and persists SMTP evidence", async () => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue(gmailFailure("GMAIL_SEND_REJECTED", "EXPLICIT_REJECTION", true));

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: true, providerId: "smtp-message-1", deliveryProvider: "SMTP" });

        expect(sendViaSMTP).toHaveBeenCalledTimes(1);
        expect(sentEmailData()).toEqual(expect.objectContaining({ deliveryProvider: "SMTP", mailboxId: null }));
    });

    it.each([401, 403])("uses approved SMTP fallback after Gmail HTTP %s explicit rejection", async () => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue(gmailFailure("GMAIL_SEND_REJECTED", "EXPLICIT_REJECTION", true));

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual(expect.objectContaining({ success: true, deliveryProvider: "SMTP" }));
        expect(sendViaSMTP).toHaveBeenCalledTimes(1);
    });

    it("uses approved SMTP fallback after Gmail HTTP 429 explicit rejection", async () => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue(gmailFailure("GMAIL_SEND_REJECTED", "EXPLICIT_REJECTION", true));

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual(expect.objectContaining({ success: true, deliveryProvider: "SMTP" }));
        expect(sendViaSMTP).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["HTTP 500", "GMAIL_SEND_FAILED"],
        ["timeout", "GMAIL_SEND_TIMEOUT"],
        ["network failure", "GMAIL_SEND_FAILED"],
        ["malformed 2xx response", "GMAIL_SEND_RESPONSE_INVALID"],
    ] as const)("does not fall back to SMTP after ambiguous Gmail %s", async (_caseName, error) => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue(gmailFailure(error, "AMBIGUOUS", false));

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: false, error });

        expect(getSmtpConfig).not.toHaveBeenCalled();
        expect(sendViaSMTP).not.toHaveBeenCalled();
        expect(prisma.email.create).not.toHaveBeenCalled();
    });

    it("permits SMTP fallback after a definite Gmail pre-dispatch failure", async () => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue(gmailFailure("GMAIL_SEND_PRE_DISPATCH_FAILED", "PRE_DISPATCH_NO_SEND", true));

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: true, providerId: "smtp-message-1", deliveryProvider: "SMTP" });
        expect(sendViaSMTP).toHaveBeenCalledTimes(1);
        expect(sentEmailData()).toEqual(expect.objectContaining({ deliveryProvider: "SMTP", mailboxId: null }));
    });

    it("returns a sanitized SMTP failure after an approved Gmail fallback", async () => {
        (selectMailboxForSend as Mock).mockResolvedValue({ id: "gmail-mailbox-1" });
        (sendViaGmailMailbox as Mock).mockResolvedValue(gmailFailure("GMAIL_SEND_REJECTED", "EXPLICIT_REJECTION", true));
        (sendViaSMTP as Mock).mockResolvedValue({ success: false, error: "SMTP credential detail must remain private" });

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: false, error: "SMTP_SEND_FAILED" });
        expect(prisma.email.create).not.toHaveBeenCalled();
    });

    it("does not send through either transport for a suppressed recipient", async () => {
        (isSuppressed as Mock).mockResolvedValue(true);

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: false, error: "RECIPIENT_SUPPRESSED" });
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
        expect(sendViaSMTP).not.toHaveBeenCalled();
    });

    it.each(["STOPPED", "REPLIED"])("keeps a %s lead paused without sending", async (status) => {
        (prisma.lead.findUnique as Mock).mockResolvedValue({ status, teamId: metadata.teamId });

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: false, error: "LEAD_SEQUENCE_PAUSED" });
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
        expect(sendViaSMTP).not.toHaveBeenCalled();
    });

    it("rejects a leadId that belongs to a different team", async () => {
        (prisma.lead.findUnique as Mock).mockResolvedValue({ status: "new", teamId: "team-other" });

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: false, error: "LEAD_TEAM_MISMATCH" });
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
        expect(sendViaSMTP).not.toHaveBeenCalled();
        expect(prisma.email.create).not.toHaveBeenCalled();
    });

    it("rejects a campaignId that belongs to a different team", async () => {
        (prisma.campaign.findUnique as Mock).mockResolvedValue({ teamId: "team-other" });

        await expect(emailService.sendEmail("recipient@example.test", "Subject", "<p>Body</p>", metadata))
            .resolves.toEqual({ success: false, error: "CAMPAIGN_TEAM_MISMATCH" });
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
        expect(sendViaSMTP).not.toHaveBeenCalled();
        expect(prisma.email.create).not.toHaveBeenCalled();
    });
});
