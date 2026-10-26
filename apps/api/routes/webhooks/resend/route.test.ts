import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma, mockVerifySvixSignature, mockDecryptCredential, mockAdvanceLeadAfterEmailOpened, mockAdvanceLeadAfterEmailClicked, mockAdvanceLeadAfterReply, mockResendReceivingGet, mockScoreAndPersist } = vi.hoisted(() => ({
    mockPrisma: {
        email: { findFirst: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
        connectedMailbox: { findUnique: vi.fn() },
        emailEvent: { create: vi.fn() },
        message: { create: vi.fn() },
        suppressionEntry: { upsert: vi.fn() },
        lead: { update: vi.fn() },
        // Runs the callback against the same mocks, so a rejection inside it propagates.
        $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(mockPrisma)),
    },
    mockVerifySvixSignature: vi.fn(),
    mockDecryptCredential: vi.fn(),
    mockAdvanceLeadAfterEmailOpened: vi.fn(),
    mockAdvanceLeadAfterEmailClicked: vi.fn(),
    mockAdvanceLeadAfterReply: vi.fn(),
    mockResendReceivingGet: vi.fn(),
    mockScoreAndPersist: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/webhooks/verifySvixSignature", () => ({ verifySvixSignature: mockVerifySvixSignature }));
vi.mock("@/lib/security/credentialVault", () => ({ decryptCredential: mockDecryptCredential }));
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterEmailOpened: mockAdvanceLeadAfterEmailOpened,
    advanceLeadAfterEmailClicked: mockAdvanceLeadAfterEmailClicked,
    advanceLeadAfterReply: mockAdvanceLeadAfterReply,
}));
vi.mock("@/modules/scoring/service/LeadScoringService", () => ({
    leadScoringService: { scoreAndPersist: mockScoreAndPersist },
}));
vi.mock("resend", () => ({
    Resend: vi.fn(function Resend() {
        return { emails: { receiving: { get: mockResendReceivingGet } } };
    }),
}));

import { POST } from "./route";

function request(body: unknown) {
    return new Request("http://localhost/webhooks/resend", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "svix-id": "msg-1", "svix-timestamp": "1", "svix-signature": "v1,sig" },
    }) as any;
}

describe("POST /webhooks/resend - email.opened idempotency", () => {
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
        mockAdvanceLeadAfterEmailClicked.mockResolvedValue(undefined);
        mockScoreAndPersist.mockResolvedValue(undefined);
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

describe("POST /webhooks/resend - email.clicked re-scores the lead", () => {
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
        mockAdvanceLeadAfterEmailClicked.mockResolvedValue(undefined);
        mockScoreAndPersist.mockResolvedValue(undefined);
    });

    it("re-scores the lead when the click claim succeeds", async () => {
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });

        await POST(request({ type: "email.clicked", data: { email_id: "provider-1" } }));

        expect(mockScoreAndPersist).toHaveBeenCalledWith("lead-1");
    });

    it("does not re-score on a redelivered click that loses the claim", async () => {
        mockPrisma.email.updateMany.mockResolvedValue({ count: 0 });

        await POST(request({ type: "email.clicked", data: { email_id: "provider-1" } }));

        expect(mockScoreAndPersist).not.toHaveBeenCalled();
    });

    it("does not fail the webhook when scoring throws", async () => {
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });
        mockScoreAndPersist.mockRejectedValue(new Error("scoring exploded"));

        const res = await POST(request({ type: "email.clicked", data: { email_id: "provider-1" } }));

        expect(res.status).toBe(200);
    });
});

describe("POST /webhooks/resend - email.received creates a real Message row", () => {
    const receivedEvent = {
        type: "email.received",
        data: {
            email_id: "resend-inbound-1",
            to: ["reply+track-1@reply.example.com"],
            from: "lead@example.com",
            subject: "Re: Following up",
        },
    };

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
            encryptedAccessToken: "encrypted-api-key",
            encryptedRefreshToken: "encrypted-webhook-secret",
        });
        mockDecryptCredential.mockImplementation(async (secret: string) =>
            secret === "encrypted-webhook-secret" ? "webhook-secret" : secret === "encrypted-api-key" ? "resend-api-key" : undefined
        );
        mockVerifySvixSignature.mockReturnValue(true);
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.emailEvent.create.mockResolvedValue({ id: "event-1" });
        mockPrisma.message.create.mockResolvedValue({});
        mockAdvanceLeadAfterReply.mockResolvedValue(undefined);
        mockScoreAndPersist.mockResolvedValue(undefined);
        mockResendReceivingGet.mockResolvedValue({
            data: { text: "Sounds good, let's talk next week.", html: "<p>Sounds good, let's talk next week.</p>", from: "Lead <lead@example.com>" },
            error: null,
        });
    });

    it("creates a Message row with the real fetched reply body, linked to the EmailEvent", async () => {
        const res = await POST(request(receivedEvent));

        expect(res.status).toBe(200);
        expect(mockResendReceivingGet).toHaveBeenCalledWith("resend-inbound-1");
        expect(mockPrisma.message.create).toHaveBeenCalledWith({
            data: {
                leadId: "lead-1",
                content: "Sounds good, let's talk next week.",
                direction: "INBOUND",
                platform: "EMAIL",
                sender: "Lead <lead@example.com>",
                status: "received",
                isRead: false,
                emailEventId: "event-1",
            },
        });
        expect(mockAdvanceLeadAfterReply).toHaveBeenCalledTimes(1);
        expect(mockScoreAndPersist).toHaveBeenCalledWith("lead-1");
    });

    it("falls back to stripped HTML when no plain-text body is returned", async () => {
        mockResendReceivingGet.mockResolvedValue({
            data: { text: null, html: "<p>Hi <b>there</b></p>", from: "lead@example.com" },
            error: null,
        });

        await POST(request(receivedEvent));

        expect(mockPrisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ content: "Hi there" }),
        }));
    });

    it("falls back to the webhook's subject line when the body fetch fails", async () => {
        mockResendReceivingGet.mockResolvedValue({ data: null, error: { message: "not found" } });

        await POST(request(receivedEvent));

        expect(mockPrisma.message.create).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ content: "Re: Following up", sender: "lead@example.com" }),
        }));
    });

    it("records a second reply to the same sent email as its own Message", async () => {
        // repliedAt is already set by the first reply; the second must still reach the Inbox.
        mockPrisma.email.updateMany.mockResolvedValue({ count: 0 });

        const res = await POST(request({ ...receivedEvent, data: { ...receivedEvent.data, email_id: "resend-inbound-2" } }));

        expect(res.status).toBe(200);
        expect(mockPrisma.emailEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ type: "REPLY_RECEIVED", providerMessageId: "resend-inbound-2" }),
        });
        expect(mockPrisma.message.create).toHaveBeenCalledTimes(1);
    });

    it("skips a redelivered reply without touching the lead or the Inbox", async () => {
        mockPrisma.emailEvent.create.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

        const res = await POST(request(receivedEvent));

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ duplicate: true });
        expect(mockAdvanceLeadAfterReply).not.toHaveBeenCalled();
        expect(mockPrisma.message.create).not.toHaveBeenCalled();
        expect(mockScoreAndPersist).not.toHaveBeenCalled();
    });

    it("answers 500 when the Message insert fails, so Resend redelivers", async () => {
        mockPrisma.message.create.mockRejectedValue(new Error("connection reset"));

        const res = await POST(request(receivedEvent));

        expect(res.status).toBe(500);
        expect(await res.json()).toEqual({ error: "Could not process the webhook event" });
        expect(mockScoreAndPersist).not.toHaveBeenCalled();
    });

    it("skips an email.received event that has no email id", async () => {
        const res = await POST(request({ ...receivedEvent, data: { ...receivedEvent.data, email_id: undefined } }));

        expect(res.status).toBe(200);
        expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });
});

describe("POST /webhooks/resend - failed side effects are retried, not lost", () => {
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
        mockPrisma.connectedMailbox.findUnique.mockResolvedValue({ id: "mailbox-1", teamId: "team-1", encryptedRefreshToken: "encrypted" });
        mockDecryptCredential.mockResolvedValue("webhook-secret");
        mockVerifySvixSignature.mockReturnValue(true);
        mockPrisma.email.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.email.update.mockResolvedValue({});
        mockPrisma.emailEvent.create.mockResolvedValue({});
        mockPrisma.suppressionEntry.upsert.mockResolvedValue({});
        mockPrisma.lead.update.mockResolvedValue({});
    });

    it("answers 500 when the open's lead-stage advance fails, inside the claim's transaction", async () => {
        mockAdvanceLeadAfterEmailOpened.mockRejectedValue(new Error("deadlock"));

        const res = await POST(request({ type: "email.opened", data: { email_id: "provider-1" } }));

        expect(res.status).toBe(500);
        expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
        expect(mockPrisma.emailEvent.create).not.toHaveBeenCalled();
    });

    it("answers 500 when the click's EmailEvent insert fails", async () => {
        mockAdvanceLeadAfterEmailClicked.mockResolvedValue(undefined);
        mockPrisma.emailEvent.create.mockRejectedValue(new Error("connection reset"));

        const res = await POST(request({ type: "email.clicked", data: { email_id: "provider-1" } }));

        expect(res.status).toBe(500);
        expect(mockScoreAndPersist).not.toHaveBeenCalled();
    });

    it("treats a duplicate bounce event as already recorded", async () => {
        mockPrisma.emailEvent.create.mockRejectedValue(Object.assign(new Error("Unique constraint failed"), { code: "P2002" }));

        const res = await POST(request({ type: "email.bounced", data: { email_id: "provider-1" } }));

        expect(res.status).toBe(200);
    });

    it("answers 500 when the complaint's opt-out update fails, but not when the lead is gone", async () => {
        const complaint = { type: "email.complained", data: { email_id: "provider-1", to: ["Lead@Example.com"] } };

        mockPrisma.lead.update.mockRejectedValueOnce(new Error("connection reset"));
        expect((await POST(request(complaint))).status).toBe(500);

        mockPrisma.lead.update.mockRejectedValueOnce(Object.assign(new Error("Record not found"), { code: "P2025" }));
        expect((await POST(request(complaint))).status).toBe(200);
        expect(mockPrisma.emailEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "COMPLAINED" }) });
    });
});
