import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockVerifySvixSignature, mockDecryptCredential, mockAdvanceLeadAfterEmailOpened } = vi.hoisted(() => ({
    mockPrisma: {
        email: { findFirst: vi.fn(), updateMany: vi.fn() },
        connectedMailbox: { findUnique: vi.fn() },
        emailEvent: { create: vi.fn() },
    },
    mockVerifySvixSignature: vi.fn(),
    mockDecryptCredential: vi.fn(),
    mockAdvanceLeadAfterEmailOpened: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/webhooks/verifySvixSignature", () => ({ verifySvixSignature: mockVerifySvixSignature }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: mockDecryptCredential }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterEmailOpened: mockAdvanceLeadAfterEmailOpened,
    advanceLeadAfterEmailClicked: vi.fn(),
    advanceLeadAfterReply: vi.fn(),
}));

import { POST } from "./route";

function request(body: unknown) {
    return new Request("http://localhost/api/webhooks/resend", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "svix-id": "msg-1", "svix-timestamp": "1", "svix-signature": "v1,sig" },
    }) as any;
}

describe("POST /api/webhooks/resend - email.opened idempotency", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPrisma.email.findFirst.mockResolvedValue({
            id: "email-1",
            leadId: "lead-1",
            campaignId: "campaign-1",
            mailboxId: "mailbox-1",
            openedAt: null,
            clickedAt: null,
            repliedAt: null,
        });
        mockPrisma.connectedMailbox.findUnique.mockResolvedValue({
            id: "mailbox-1",
            teamId: "team-1",
            encryptedRefreshToken: "encrypted",
        });
        mockDecryptCredential.mockResolvedValue("webhook-secret");
        mockVerifySvixSignature.mockReturnValue(true);
        mockPrisma.emailEvent.create.mockResolvedValue({});
        mockAdvanceLeadAfterEmailOpened.mockResolvedValue(undefined);
    });

    it("claims the open and advances the lead on first delivery", async () => {
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });

        const res = await POST(request({ type: "email.opened", data: { email_id: "provider-1" } }));

        expect(res.status).toBe(200);
        expect(mockPrisma.email.updateMany).toHaveBeenCalledWith({
            where: { id: "email-1", openedAt: null },
            data: { openedAt: expect.any(Date) },
        });
        expect(mockAdvanceLeadAfterEmailOpened).toHaveBeenCalledTimes(1);
    });

    it("does not re-advance the lead on a redelivered event for an already-opened email", async () => {
        // Simulates a webhook retry: the atomic claim matches zero rows because another
        // delivery already flipped openedAt.
        mockPrisma.email.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(request({ type: "email.opened", data: { email_id: "provider-1" } }));

        expect(res.status).toBe(200);
        expect(mockAdvanceLeadAfterEmailOpened).not.toHaveBeenCalled();
    });

    it("writes exactly one EmailEvent row when the claim succeeds", async () => {
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });

        await POST(request({ type: "email.opened", data: { email_id: "provider-1" } }));

        expect(mockPrisma.emailEvent.create).toHaveBeenCalledTimes(1);
    });

    it("does not write a duplicate EmailEvent row on a redelivery that loses the claim", async () => {
        // A redelivered event must not double-count analytics even though the lead-stage
        // advance is already guarded - this is the regression this test protects against.
        mockPrisma.email.updateMany.mockResolvedValue({ count: 0 });

        await POST(request({ type: "email.opened", data: { email_id: "provider-1" } }));

        expect(mockPrisma.emailEvent.create).not.toHaveBeenCalled();
    });
});
