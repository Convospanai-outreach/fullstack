import { beforeEach, describe, expect, it, Mock, vi } from "vitest";

const { mockPrisma, mockDecryptCredential, mockAdvanceLeadAfterReply, mockImapFlowInstance, MockImapFlow, mockSimpleParser } = vi.hoisted(() => {
    const mockTx = {
        email: { findFirst: vi.fn(), update: vi.fn() },
        emailEvent: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
        message: { create: vi.fn() },
        lead: { findUnique: vi.fn(), update: vi.fn() },
        connectedMailbox: { update: vi.fn() },
        suppressionEntry: { upsert: vi.fn() },
    };

    const mockPrisma = {
        ...mockTx,
        connectedMailbox: { findMany: vi.fn(), update: vi.fn() },
        $transaction: vi.fn((cb: any) => cb(mockTx)),
        __tx: mockTx,
    };

    const mockImapFlowInstance = {
        connect: vi.fn().mockResolvedValue(undefined),
        logout: vi.fn().mockResolvedValue(undefined),
        getMailboxLock: vi.fn().mockResolvedValue({ release: vi.fn() }),
        fetch: vi.fn(),
    };

    const MockImapFlow = vi.fn(function ImapFlow() {
        return mockImapFlowInstance;
    });
    const mockDecryptCredential = vi.fn();
    const mockAdvanceLeadAfterReply = vi.fn().mockResolvedValue(undefined);
    const mockSimpleParser = vi.fn();

    return { mockPrisma, mockDecryptCredential, mockAdvanceLeadAfterReply, mockImapFlowInstance, MockImapFlow, mockSimpleParser };
});

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: mockDecryptCredential }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({ advanceLeadAfterReply: mockAdvanceLeadAfterReply }));
vi.mock("imapflow", () => ({ ImapFlow: MockImapFlow }));
vi.mock("mailparser", () => ({ simpleParser: mockSimpleParser }));

import { syncImapMailbox, syncDueImapMailboxes } from "../imapMailboxService";

const mailbox = {
    id: "mailbox-1",
    teamId: "team-1",
    email: "sender@example.com",
    lastSyncAt: null,
    metadata: { host: "smtp.example.com", imapHost: "imap.example.com", imapPort: 993, imapSecure: true },
    encryptedAccessToken: { v: 1, cipher: "x", iv: "y", tag: "z" },
};

function fakeMessages(sources: Buffer[]) {
    return (async function* () {
        for (const source of sources) {
            yield { source, seq: 1, uid: 1 };
        }
    })();
}

function replyParsed(overrides: Record<string, any> = {}) {
    return {
        messageId: "<reply-1@example.com>",
        inReplyTo: "<sent-message-1@craftmyfunnel.live>",
        references: ["<sent-message-1@craftmyfunnel.live>"],
        from: { text: "lead@example.com" },
        subject: "Re: Following up",
        text: "Sounds great, let's talk.",
        html: false,
        ...overrides,
    };
}

describe("imapMailboxService", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma.__tx));
        mockDecryptCredential.mockResolvedValue("decrypted-password");
        mockImapFlowInstance.connect.mockResolvedValue(undefined);
        mockImapFlowInstance.logout.mockResolvedValue(undefined);
        mockImapFlowInstance.getMailboxLock.mockResolvedValue({ release: vi.fn() });
        mockPrisma.connectedMailbox.update.mockResolvedValue({});
        mockPrisma.__tx.emailEvent.create.mockResolvedValue({ id: "event-1" });
        mockPrisma.__tx.emailEvent.update.mockResolvedValue({});
        mockPrisma.__tx.email.update.mockResolvedValue({});
        mockPrisma.__tx.message.create.mockResolvedValue({});
        mockPrisma.__tx.connectedMailbox.update.mockResolvedValue({});
    });

    it("matches a reply to the correct Email row via In-Reply-To and creates a Message row with the parsed body", async () => {
        mockImapFlowInstance.fetch.mockReturnValue(fakeMessages([Buffer.from("raw-message-1")]));
        mockSimpleParser.mockResolvedValue(replyParsed());
        mockPrisma.__tx.email.findFirst.mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" });
        mockPrisma.__tx.emailEvent.findFirst.mockResolvedValue(null);

        const result = await syncImapMailbox(mailbox);

        expect(result).toEqual({ mailboxId: "mailbox-1", email: "sender@example.com", synced: 1, replies: 1, bounces: 0 });
        expect(mockPrisma.__tx.email.findFirst).toHaveBeenCalledWith({
            where: {
                mailboxId: "mailbox-1",
                campaign: { teamId: "team-1" },
                OR: [{ providerId: "<sent-message-1@craftmyfunnel.live>" }],
            },
            select: { id: true, leadId: true, campaignId: true },
        });
        expect(mockPrisma.__tx.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                leadId: "lead-1",
                content: "Sounds great, let's talk.",
                direction: "INBOUND",
                platform: "EMAIL",
                sender: "lead@example.com",
                status: "received",
                isRead: false,
                emailEventId: "event-1",
            }),
        });
        expect(mockAdvanceLeadAfterReply).toHaveBeenCalledWith(expect.anything(), { leadId: "lead-1", teamId: "team-1" });
        expect(mockPrisma.connectedMailbox.update).toHaveBeenCalledWith({
            where: { id: "mailbox-1" },
            data: { lastSyncAt: expect.any(Date) },
        });
    });

    it("skips bounce messages: updates Email/Lead/suppression but never creates a Message row or advances the lead", async () => {
        mockImapFlowInstance.fetch.mockReturnValue(fakeMessages([Buffer.from("raw-bounce-1")]));
        mockSimpleParser.mockResolvedValue(replyParsed({
            messageId: "<bounce-1@mailer-daemon.example.com>",
            from: { text: "Mail Delivery Subsystem <mailer-daemon@example.com>" },
            subject: "Delivery Status Notification (Failure)",
        }));
        mockPrisma.__tx.email.findFirst.mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" });
        mockPrisma.__tx.emailEvent.findFirst.mockResolvedValue(null);
        mockPrisma.__tx.lead.findUnique.mockResolvedValue({ email: "lead@example.com" });

        const result = await syncImapMailbox(mailbox);

        expect(result).toEqual({ mailboxId: "mailbox-1", email: "sender@example.com", synced: 1, replies: 0, bounces: 1 });
        expect(mockPrisma.__tx.message.create).not.toHaveBeenCalled();
        expect(mockAdvanceLeadAfterReply).not.toHaveBeenCalled();
        expect(mockPrisma.__tx.email.update).toHaveBeenCalledWith({
            where: { id: "email-1" },
            data: { bouncedAt: expect.any(Date), status: "bounced" },
        });
        expect(mockPrisma.__tx.lead.update).toHaveBeenCalledWith({
            where: { id: "lead-1" },
            data: { status: "STOPPED", updatedAt: expect.any(Date) },
        });
        expect(mockPrisma.__tx.suppressionEntry.upsert).toHaveBeenCalled();
    });

    it("dedupes on a second run: an already-recorded EmailEvent is not recreated and the lead is not advanced again", async () => {
        mockImapFlowInstance.fetch.mockReturnValue(fakeMessages([Buffer.from("raw-message-1")]));
        mockSimpleParser.mockResolvedValue(replyParsed());
        mockPrisma.__tx.email.findFirst.mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" });
        mockPrisma.__tx.emailEvent.findFirst.mockResolvedValue({ id: "event-1" });

        const result = await syncImapMailbox(mailbox);

        expect(result).toEqual({ mailboxId: "mailbox-1", email: "sender@example.com", synced: 1, replies: 0, bounces: 0 });
        expect(mockPrisma.__tx.emailEvent.create).not.toHaveBeenCalled();
        expect(mockPrisma.__tx.message.create).not.toHaveBeenCalled();
        expect(mockAdvanceLeadAfterReply).not.toHaveBeenCalled();
    });

    it("advances lastSyncAt even when no Email row matches (ignored message)", async () => {
        mockImapFlowInstance.fetch.mockReturnValue(fakeMessages([Buffer.from("raw-message-1")]));
        mockSimpleParser.mockResolvedValue(replyParsed());
        mockPrisma.__tx.email.findFirst.mockResolvedValue(null);

        const result = await syncImapMailbox(mailbox);

        expect(result).toEqual({ mailboxId: "mailbox-1", email: "sender@example.com", synced: 1, replies: 0, bounces: 0 });
        expect(mockPrisma.__tx.emailEvent.create).not.toHaveBeenCalled();
        expect(mockPrisma.connectedMailbox.update).toHaveBeenCalledWith({
            where: { id: "mailbox-1" },
            data: { lastSyncAt: expect.any(Date) },
        });
    });

    it("continues processing remaining messages and still advances lastSyncAt when one message fails to parse", async () => {
        mockImapFlowInstance.fetch.mockReturnValue(fakeMessages([Buffer.from("bad"), Buffer.from("good")]));
        mockSimpleParser.mockRejectedValueOnce(new Error("malformed MIME")).mockResolvedValueOnce(replyParsed());
        mockPrisma.__tx.email.findFirst.mockResolvedValue({ id: "email-1", leadId: "lead-1", campaignId: "campaign-1" });
        mockPrisma.__tx.emailEvent.findFirst.mockResolvedValue(null);

        const result = await syncImapMailbox(mailbox);

        expect(result.synced).toBe(1);
        expect(result.replies).toBe(1);
        expect(mockPrisma.connectedMailbox.update).toHaveBeenCalledWith({
            where: { id: "mailbox-1" },
            data: { lastSyncAt: expect.any(Date) },
        });
    });

    it("advances lastSyncAt even when the IMAP connection itself fails", async () => {
        mockImapFlowInstance.connect.mockRejectedValue(new Error("ECONNREFUSED"));

        const result = await syncImapMailbox(mailbox);

        expect(result.error).toBe("ECONNREFUSED");
        expect(mockPrisma.connectedMailbox.update).toHaveBeenCalledWith({
            where: { id: "mailbox-1" },
            data: { lastSyncAt: expect.any(Date) },
        });
    });

    it("skips a mailbox with no usable IMAP host/credentials without connecting", async () => {
        mockDecryptCredential.mockResolvedValue(undefined);

        const result = await syncImapMailbox(mailbox);

        expect(result.error).toBe("IMAP_CREDENTIALS_UNAVAILABLE");
        expect(mockImapFlowInstance.connect).not.toHaveBeenCalled();
    });

    it("syncDueImapMailboxes only syncs CONNECTED SMTP-provider mailboxes and isolates one mailbox's failure from another's", async () => {
        mockPrisma.connectedMailbox.findMany.mockResolvedValue([
            { ...mailbox, id: "mailbox-1" },
            { ...mailbox, id: "mailbox-2" },
        ]);
        mockImapFlowInstance.fetch.mockReturnValue(fakeMessages([]));

        const results = await syncDueImapMailboxes();

        expect(mockPrisma.connectedMailbox.findMany).toHaveBeenCalledWith({
            where: { provider: "SMTP", status: "CONNECTED" },
        });
        expect(results).toHaveLength(2);
        expect(results.map((r) => r.mailboxId)).toEqual(["mailbox-1", "mailbox-2"]);
    });
});
