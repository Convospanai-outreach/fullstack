import { describe, it, expect, vi, beforeEach } from "vitest";

const mockDb = vi.hoisted(() => ({
    connectedMailbox: { findFirst: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: mockDb }));

const mockDecryptCredential = vi.hoisted(() => vi.fn());
vi.mock("@/lib/security/credentialVault", () => ({
    decryptCredential: mockDecryptCredential,
    encryptCredential: vi.fn(),
}));

const mockFetch = vi.hoisted(() => vi.fn());

import { sendViaGmailMailbox } from "../googleMailboxService";

function mailbox() {
    return {
        id: "mailbox-1",
        teamId: "team-1",
        email: "owner@example.com",
        displayName: null,
        status: "CONNECTED",
        encryptedAccessToken: { v: 1, cipher: "x", iv: "x", tag: "x" },
        tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    };
}

function response(data: any, ok = true, status = 200) {
    return { ok, status, json: async () => data };
}

describe("sendViaGmailMailbox (apps/web)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        global.fetch = mockFetch as unknown as typeof fetch;
        mockDb.connectedMailbox.findFirst.mockResolvedValue(mailbox());
        mockDecryptCredential.mockResolvedValue("access-token");
    });

    it("does not perform its own quota bookkeeping - the caller already claimed the send slot atomically", async () => {
        mockFetch
            .mockResolvedValueOnce(response({ id: "gmail-message-1", threadId: "gmail-thread-1" }))
            .mockResolvedValueOnce(response({ payload: { headers: [{ name: "Message-ID", value: "<wire-id@gmail.com>" }] } }));

        const result = await sendViaGmailMailbox({
            teamId: "team-1",
            mailboxId: "mailbox-1",
            to: "recipient@example.com",
            subject: "Hello",
            html: "<p>content</p>",
        });

        expect(result.success).toBe(true);
        // Regression guard: this used to call markMailboxSend internally, double-counting
        // every Gmail send against the mailbox's daily/warmup quota on top of the atomic
        // claim handleEmailSending already performs before invoking this provider.
        expect(mockDb.connectedMailbox.update).not.toHaveBeenCalled();
    });
});
