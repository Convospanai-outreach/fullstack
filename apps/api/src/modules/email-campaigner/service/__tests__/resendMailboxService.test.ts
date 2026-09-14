import { beforeEach, describe, expect, it, Mock, vi } from "vitest";
import { sendViaResendMailbox } from "../resendMailboxService";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { reserveMailboxSend, releaseMailboxSend } from "../googleMailboxService";

const { mockPrisma, mockResendSend } = vi.hoisted(() => ({
    mockPrisma: { connectedMailbox: { findFirst: vi.fn() } },
    mockResendSend: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: vi.fn() }));
vi.mock("../googleMailboxService", () => ({
    reserveMailboxSend: vi.fn(),
    releaseMailboxSend: vi.fn(),
}));
vi.mock("resend", () => ({
    Resend: vi.fn().mockImplementation(function (this: any) {
        this.emails = { send: mockResendSend };
    }),
}));

const mailbox = {
    id: "resend-mailbox-1",
    teamId: "team-1",
    email: "outreach@team.test",
    displayName: "Team Outreach",
    status: "CONNECTED",
    encryptedAccessToken: { encrypted: true },
    metadata: { inboundDomain: "reply.team.test" },
};

describe("sendViaResendMailbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue(mailbox);
        (decryptCredential as Mock).mockResolvedValue("re_test_api_key");
        (reserveMailboxSend as Mock).mockResolvedValue({ ok: true, mailbox });
        mockResendSend.mockResolvedValue({ data: { id: "resend-message-1" }, error: null });
    });

    it("sends with a plus-addressed reply-to when the mailbox has an inbound domain configured", async () => {
        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result).toEqual({
            success: true,
            deliveryProvider: "RESEND",
            messageId: "resend-message-1",
            mailboxId: "resend-mailbox-1",
        });
        expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
            from: "Team Outreach <outreach@team.test>",
            to: "lead@example.test",
            replyTo: "reply+track-1@reply.team.test",
        }), undefined);
    });

    it("omits reply-to when the mailbox has no inbound domain configured", async () => {
        (prisma.connectedMailbox.findFirst as Mock).mockResolvedValue({ ...mailbox, metadata: null });

        await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(mockResendSend).toHaveBeenCalledWith(expect.not.objectContaining({ replyTo: expect.anything() }), undefined);
    });

    it("releases the reserved send slot and reports a fallback-allowed failure when Resend rejects the send", async () => {
        mockResendSend.mockResolvedValue({ data: null, error: { message: "invalid_api_key" } });

        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result).toEqual({ success: false, error: "RESEND_SEND_FAILED", fallbackAllowed: true });
        expect(releaseMailboxSend).toHaveBeenCalledWith("team-1", "resend-mailbox-1");
    });

    it("fails pre-dispatch without reserving a send slot when no API key can be decrypted", async () => {
        (decryptCredential as Mock).mockResolvedValue(undefined);

        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result).toEqual({ success: false, error: "RESEND_SEND_PRE_DISPATCH_FAILED", fallbackAllowed: true });
        expect(reserveMailboxSend).not.toHaveBeenCalled();
    });

    it("passes attachments and RFC 8058 unsubscribe headers through to Resend", async () => {
        await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
            unsubscribeUrl: "https://app.test/api/proxy/email/unsubscribe/track-1",
            attachments: [{ filename: "deck.pptx", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation", content: "YmFzZTY0" }],
        });

        expect(mockResendSend).toHaveBeenCalledWith(expect.objectContaining({
            attachments: [{ filename: "deck.pptx", content: "YmFzZTY0" }],
            headers: {
                "List-Unsubscribe": "<https://app.test/api/proxy/email/unsubscribe/track-1>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
        }), undefined);
    });

    it("passes idempotencyKey through to Resend when provided, and omits it otherwise", async () => {
        await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
            idempotencyKey: "sequence_step_run_run-1_send",
        });

        expect(mockResendSend).toHaveBeenCalledWith(
            expect.any(Object),
            { idempotencyKey: "sequence_step_run_run-1_send" }
        );
    });

    it("marks a rate-limit rejection as retryable (sequenceService pattern-matches 'try again')", async () => {
        mockResendSend.mockResolvedValue({ data: null, error: { name: "rate_limit_exceeded", statusCode: 429, message: "Too many requests" } });

        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/try again/i);
    });

    it.each(["daily_quota_exceeded", "application_error"])(
        "marks a %s rejection as retryable, matching apps/web's ResendProvider classification",
        async (errorName) => {
            mockResendSend.mockResolvedValue({ data: null, error: { name: errorName, statusCode: 500, message: "x" } });

            const result = await sendViaResendMailbox({
                teamId: "team-1",
                mailboxId: "resend-mailbox-1",
                to: "lead@example.test",
                subject: "Subject",
                html: "<p>Body</p>",
                trackingId: "track-1",
            });

            expect(result.success).toBe(false);
            expect((result as any).error).toMatch(/try again/i);
        }
    );

    it("marks a validation rejection as permanent, not retryable", async () => {
        mockResendSend.mockResolvedValue({ data: null, error: { name: "validation_error", statusCode: 422, message: "Invalid `to` field" } });

        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result.success).toBe(false);
        expect((result as any).error).not.toMatch(/try again|rate limit|temporar/i);
    });

    it("marks a thrown network/transport error as retryable but NOT fallback-allowed (Resend may have already sent it)", async () => {
        mockResendSend.mockRejectedValue(new Error("ETIMEDOUT"));

        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result.success).toBe(false);
        expect((result as any).error).toMatch(/try again/i);
        // Must be false: an SMTP fallback in the same call has no idempotency
        // protection and would risk a real duplicate send.
        expect((result as any).fallbackAllowed).toBe(false);
    });

    it("fails pre-dispatch without a send attempt when the mailbox's send-slot reservation is denied", async () => {
        (reserveMailboxSend as Mock).mockResolvedValue({ ok: false, reason: "Daily send limit reached." });

        const result = await sendViaResendMailbox({
            teamId: "team-1",
            mailboxId: "resend-mailbox-1",
            to: "lead@example.test",
            subject: "Subject",
            html: "<p>Body</p>",
            trackingId: "track-1",
        });

        expect(result).toEqual({ success: false, error: "RESEND_SEND_PRE_DISPATCH_FAILED", fallbackAllowed: true });
        expect(mockResendSend).not.toHaveBeenCalled();
    });
});
