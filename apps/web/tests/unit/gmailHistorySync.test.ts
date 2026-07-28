import { describe, it, expect, vi, beforeEach } from "vitest";
import { syncGmailInboundReplies } from "@/modules/email-campaigner/service/googleMailboxService";
import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    connectedMailbox: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    email: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    emailEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    message: {
      create: vi.fn(),
    },
    lead: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    suppressionEntry: {
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/security/credentialVault", () => ({
  decryptCredential: vi.fn().mockResolvedValue("mock-access-token"),
  encryptCredential: vi.fn().mockResolvedValue({ v: 1, cipher: "abc", iv: "def", tag: "ghi" }),
}));

describe("syncGmailInboundReplies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero stats if mailbox is not found or not connected", async () => {
    (prisma.connectedMailbox.findUnique as any).mockResolvedValueOnce(null);
    const result = await syncGmailInboundReplies("missing-id");
    expect(result).toEqual({ synced: 0, replies: 0, bounces: 0 });
  });

  it("successfully detects inbound reply, creates REPLY_RECEIVED event, inbound message, and updates lead to REPLIED", async () => {
    const mockMailbox = {
      id: "mb-123",
      teamId: "team-456",
      email: "outreach@company.com",
      status: "CONNECTED",
      encryptedAccessToken: { v: 1, cipher: "abc", iv: "def", tag: "ghi" },
      tokenExpiresAt: new Date(Date.now() + 3600_000),
      historyId: "1001",
    };
    (prisma.connectedMailbox.findUnique as any).mockResolvedValueOnce(mockMailbox);

    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/history")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              historyId: "1002",
              history: [
                {
                  messagesAdded: [{ message: { id: "msg-inbound-1" } }],
                },
              ],
            }),
        } as Response);
      }
      if (url.includes("/messages/msg-inbound-1")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              id: "msg-inbound-1",
              threadId: "thread-999",
              payload: {
                headers: [
                  { name: "From", value: "Prospect <prospect@prospectcompany.com>" },
                  { name: "Subject", value: "Re: Partnership opportunity" },
                  { name: "In-Reply-To", value: "<outbound-msg-id-123@company.com>" },
                  { name: "References", value: "<outbound-msg-id-123@company.com>" },
                ],
              },
            }),
        } as Response);
      }
      return Promise.reject(new Error(`Unmocked fetch url: ${url}`));
    });

    (prisma.email.findFirst as any).mockResolvedValueOnce({
      id: "email-001",
      leadId: "lead-777",
      campaignId: "campaign-888",
    });

    (prisma.emailEvent.findFirst as any).mockResolvedValueOnce(null);
    (prisma.emailEvent.create as any).mockResolvedValueOnce({ id: "evt-999" });
    (prisma.message.create as any).mockResolvedValueOnce({ id: "msg-db-1" });
    (prisma.lead.update as any).mockResolvedValueOnce({ id: "lead-777", status: "REPLIED" });
    (prisma.email.update as any).mockResolvedValueOnce({ id: "email-001", status: "replied" });
    (prisma.connectedMailbox.update as any).mockResolvedValue({ id: "mb-123" });

    const result = await syncGmailInboundReplies("mb-123", "1002");

    expect(result.synced).toBe(1);
    expect(result.replies).toBe(1);
    expect(result.bounces).toBe(0);

    expect(prisma.emailEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          teamId: "team-456",
          emailId: "email-001",
          mailboxId: "mb-123",
          leadId: "lead-777",
          type: "REPLY_RECEIVED",
          provider: "GMAIL_API",
          providerMessageId: "msg-inbound-1",
        }),
      })
    );

    expect(prisma.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "lead-777",
          direction: "INBOUND",
          platform: "EMAIL",
          status: "received",
          emailEventId: "evt-999",
        }),
      })
    );

    expect(prisma.lead.update).toHaveBeenCalledWith({
      where: { id: "lead-777" },
      data: { status: "REPLIED" },
    });
  });
});
