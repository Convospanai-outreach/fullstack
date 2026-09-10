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
        }));
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

        expect(mockResendSend).toHaveBeenCalledWith(expect.not.objectContaining({ replyTo: expect.anything() }));
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
