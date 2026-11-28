import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    $transaction: vi.fn(),
    message: { upsert: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    overseerNudge: { findMany: vi.fn(), count: vi.fn() },
    meeting: { findMany: vi.fn(), count: vi.fn() },
    lead: { findFirst: vi.fn(), update: vi.fn() },
    email: { findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    job: { findFirst: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    connectedMailbox: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
    replyTracker: { findMany: vi.fn() },
    whatsAppMessage: { findMany: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/lib/queue", () => ({ JobQueue: { enqueue: vi.fn() } }));
vi.mock("@/lib/security/credentialVault", () => ({ encryptCredential: vi.fn() }));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    isSuppressed: vi.fn(),
    recordSuppression: vi.fn(),
    sendViaGmailMailbox: vi.fn(),
}));
vi.mock("@/modules/email-campaigner/service/resendMailboxService", () => ({ sendViaResendMailbox: vi.fn() }));
vi.mock("@/modules/email-campaigner/service/smtpConfigService", () => ({ sendViaSmtpMailbox: vi.fn() }));
vi.mock("@/modules/governance/service/guardrailService", () => ({
    guardrailService: { evaluate: vi.fn() },
}));
vi.mock("@/modules/email-campaigner/service/sequenceService", () => ({
    SequenceService: { stopEnrollmentsForLead: vi.fn() },
}));
vi.mock("@/modules/creator-funnel/socialInbox", () => ({
    REPLY_WINDOW_MS: 24 * 60 * 60 * 1000,
    sendSocialReply: vi.fn(),
}));
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterMeetingScheduled: vi.fn(),
    advanceLeadToLost: vi.fn(),
}));

import {
    getInbox,
    getInboxReply,
    getThread,
    markReplyDoNotContact,
    markReplyOutcome,
    markReplyRead,
    sendReply,
    scheduleInboxReply,
    scheduledInboxReplyStatus,
    toSnippet,
} from "../actionInboxService";
import { isSuppressed, recordSuppression, sendViaGmailMailbox } from "@/modules/email-campaigner/service/googleMailboxService";
import { sendViaResendMailbox } from "@/modules/email-campaigner/service/resendMailboxService";
import { sendViaSmtpMailbox } from "@/modules/email-campaigner/service/smtpConfigService";
import { guardrailService } from "@/modules/governance/service/guardrailService";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";
import { advanceLeadAfterMeetingScheduled, advanceLeadToLost } from "@/lib/crm/leadStageTransitions";
import { sendSocialReply } from "@/modules/creator-funnel/socialInbox";
import { JobQueue } from "@/lib/queue";
import { encryptCredential } from "@/lib/security/credentialVault";

function inboundReply(overrides: any = {}) {
    return {
        id: "msg-1",
        leadId: "lead-1",
        platform: "EMAIL",
        createdAt: new Date("2026-11-25T10:00:00Z"),
        lead: { email: "lead@example.test", status: "REPLIED", replyOutcome: null },
        emailEvent: { email: { id: "email-1", subject: "Quick question", campaignId: "campaign-1", mailboxId: "mailbox-1" } },
        ...overrides,
    };
}

describe("toSnippet", () => {
    it("strips HTML and truncates to 200 characters", () => {
        const html = `<html><head><style>p{}</style></head><body><p>Hi &amp; thanks</p><script>x()</script>${"a".repeat(300)}</body></html>`;
        const snippet = toSnippet(html);

        expect(snippet.startsWith("Hi & thanks")).toBe(true);
        expect(snippet).not.toMatch(/<|p\{\}|x\(\)/);
        expect(snippet).toHaveLength(200);
    });
});

describe("getInbox", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.message.findMany.mockResolvedValue([]);
        mockDb.message.count.mockResolvedValue(0);
        mockDb.overseerNudge.findMany.mockResolvedValue([]);
        mockDb.overseerNudge.count.mockResolvedValue(0);
        mockDb.meeting.findMany.mockResolvedValue([]);
        mockDb.meeting.count.mockResolvedValue(0);
        mockDb.replyTracker.findMany.mockResolvedValue([]);
    });

    it("attaches the AI suggestion for each reply, read through the caller's team", async () => {
        mockDb.message.findMany.mockResolvedValue([{
            id: "msg-1", leadId: "lead-1", content: "Stop emailing me", platform: "EMAIL", isRead: false, sentimentScore: null,
            createdAt: new Date(), lead: { fullName: "A", company: null, email: "a@x.test", replyOutcome: null }, emailEvent: null,
        }, {
            id: "msg-2", leadId: "lead-2", content: "hello", platform: "EMAIL", isRead: false, sentimentScore: null,
            createdAt: new Date(), lead: { fullName: "B", company: null, email: "b@x.test", replyOutcome: null }, emailEvent: null,
        }]);
        mockDb.replyTracker.findMany.mockResolvedValue([
            { emailId: "msg-1", aiClassification: "DNC", aiConfidence: 0.95, aiReasoning: "asked to stop", replyDraft: null },
        ]);

        const inbox = await getInbox("team-a", { page: 1, limit: 20 });

        expect(mockDb.replyTracker.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { emailId: { in: ["msg-1", "msg-2"] }, status: "PENDING_REVIEW", lead: { teamId: "team-a" } },
        }));
        expect(inbox.replies.items[0]!.suggestion).toEqual({
            classification: "DNC", suggestedOutcome: "not_interested", askedNotToContact: true,
            confidence: 0.95, reasoning: "asked to stop", suggestedReply: null,
        });
        expect(inbox.replies.items[1]!.suggestion).toBeNull();
    });

    it("only loads older linked replies through the caller's inbound team scope", async () => {
        mockDb.message.findFirst.mockResolvedValueOnce(null);
        await expect(getInboxReply("team-a", "foreign-reply")).resolves.toBeNull();
        expect(mockDb.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "foreign-reply", direction: "INBOUND", lead: { teamId: "team-a" } },
        }));
    });

    it("scopes every list to the caller's team and paginates replies newest-first", async () => {
        const now = new Date("2026-09-30T06:00:00Z");
        await getInbox("team-a", { page: 3, limit: 10 }, now);

        expect(mockDb.message.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { direction: "INBOUND", lead: { teamId: "team-a" } },
            orderBy: { createdAt: "desc" },
            skip: 20,
            take: 10,
        }));
        expect(mockDb.overseerNudge.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { teamId: "team-a", status: "OPEN" } }));
        expect(mockDb.meeting.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { teamId: "team-a", startTime: { gte: now, lte: new Date("2026-10-02T06:00:00Z") } },
        }));
        expect(mockDb.message.count).toHaveBeenCalledWith({ where: { direction: "INBOUND", lead: { teamId: "team-a" }, isRead: false } });
    });

    it("maps replies with lead, campaign and sequence context", async () => {
        mockDb.message.findMany.mockResolvedValue([{
            id: "msg-1",
            leadId: "lead-1",
            content: "<p>Sounds good</p>",
            platform: "EMAIL",
            isRead: false,
            sentimentScore: 0.8,
            createdAt: new Date(),
            lead: { fullName: "Asha Rao", company: "Acme", email: "asha@acme.test", replyOutcome: null },
            emailEvent: { email: { subject: "Hi", campaign: { name: "Q4 outbound" }, sequenceStepRuns: [{ enrollment: { sequence: { name: "3-step" } } }] } },
        }]);
        mockDb.message.count.mockResolvedValue(1);

        const inbox = await getInbox("team-a", { page: 1, limit: 20 });

        expect(inbox.replies.items[0]).toMatchObject({
            leadName: "Asha Rao",
            company: "Acme",
            campaignName: "Q4 outbound",
            sequenceName: "3-step",
            snippet: "Sounds good",
            isRead: false,
        });
        expect(inbox.replies.total).toBe(1);
    });

    it("adds the handle and reply-window end for Instagram/Facebook messages only", async () => {
        const lastInboundAt = new Date("2026-09-30T06:00:00Z");
        const base = { leadId: "lead-1", content: "hi", isRead: false, sentimentScore: null, createdAt: new Date(), emailEvent: null };
        const lead = { fullName: null, company: null, email: null, replyOutcome: null, socialContacts: [{ handle: "@asha", lastInboundAt }] };
        mockDb.message.findMany.mockResolvedValue([
            { ...base, id: "msg-ig", platform: "INSTAGRAM", lead },
            { ...base, id: "msg-email", platform: "EMAIL", lead },
        ]);

        const inbox = await getInbox("team-a", { page: 1, limit: 20 });

        expect(inbox.replies.items[0]).toMatchObject({ platform: "INSTAGRAM", handle: "@asha", replyWindowEndsAt: new Date("2026-10-01T06:00:00Z") });
        expect(inbox.replies.items[1]).toMatchObject({ platform: "EMAIL", handle: null, replyWindowEndsAt: null });
    });
});

describe("getThread", () => {
    beforeEach(() => vi.clearAllMocks());

    it("404s for a lead outside the caller's team without reading its messages", async () => {
        mockDb.lead.findFirst.mockResolvedValue(null);

        await expect(getThread("team-a", "lead-from-team-b")).rejects.toMatchObject({ statusCode: 404 });
        expect(mockDb.lead.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "lead-from-team-b", teamId: "team-a" } }));
        expect(mockDb.message.findMany).not.toHaveBeenCalled();
    });

    it("merges the team's sent campaign emails with reply messages in time order, as plain text", async () => {
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1" });
        mockDb.message.findMany.mockResolvedValue([
            { id: "m2", direction: "INBOUND", content: "<div>Thanks<br>Asha</div>", createdAt: new Date("2026-09-29T10:00:00Z") },
            { id: "m3", direction: "OUTBOUND", content: "Tuesday works", createdAt: new Date("2026-09-29T11:00:00Z") },
        ]);
        mockDb.email.findMany.mockResolvedValue([
            { id: "e1", body: "<p>Hi Asha, quick question</p>", createdAt: new Date("2026-09-28T09:00:00Z"), mailbox: { displayName: "Priya", email: "priya@x.test" } },
        ]);

        const thread = await getThread("team-a", "lead-1");

        expect(mockDb.message.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "lead-1", status: { not: "draft" } } }));
        expect(thread.messages.map((m: any) => [m.id, m.direction, m.sender ?? null, m.text])).toEqual([
            ["email-e1", "OUTBOUND", "Priya", "Hi Asha, quick question"],
            ["m2", "INBOUND", null, "Thanks\nAsha"],
            ["m3", "OUTBOUND", null, "Tuesday works"],
        ]);
    });

    it("includes the lead's WhatsApp messages, both directions, in time order", async () => {
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1" });
        mockDb.message.findMany.mockResolvedValue([]);
        mockDb.email.findMany.mockResolvedValue([
            { id: "e1", body: "<p>Hi Asha</p>", createdAt: new Date("2026-09-28T09:00:00Z"), mailbox: null },
        ]);
        mockDb.whatsAppMessage.findMany.mockResolvedValueOnce([
            { id: "w1", body: "Following up here", direction: "OUTBOUND", createdAt: new Date("2026-09-29T09:00:00Z") },
            { id: "w2", body: "Sure, call me", direction: "INBOUND", createdAt: new Date("2026-09-29T10:00:00Z") },
        ]);

        const thread = await getThread("team-a", "lead-1");

        expect(mockDb.whatsAppMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { leadId: "lead-1" } }));
        expect(thread.messages.map((m: any) => [m.id, m.direction, m.platform, m.text])).toEqual([
            ["email-e1", "OUTBOUND", "EMAIL", "Hi Asha"],
            ["whatsapp-w1", "OUTBOUND", "WHATSAPP", "Following up here"],
            ["whatsapp-w2", "INBOUND", "WHATSAPP", "Sure, call me"],
        ]);
    });

    it("reads no WhatsApp messages for a lead outside the caller's team", async () => {
        mockDb.lead.findFirst.mockResolvedValue(null);

        await expect(getThread("team-a", "lead-from-team-b")).rejects.toMatchObject({ statusCode: 404 });
        expect(mockDb.whatsAppMessage.findMany).not.toHaveBeenCalled();
    });

    it("scopes sent emails to the team and skips the Email rows written by inbox replies (their Message is shown)", async () => {
        mockDb.lead.findFirst.mockResolvedValue({ id: "lead-1" });
        mockDb.message.findMany.mockResolvedValue([]);
        mockDb.email.findMany.mockResolvedValue([]);

        await getThread("team-a", "lead-1");

        expect(mockDb.email.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: {
                leadId: "lead-1",
                campaign: { teamId: "team-a" },
                OR: [{ idempotencyKey: null }, { NOT: { idempotencyKey: { startsWith: "inbox_reply_" } } }],
            },
        }));
    });
});

describe("markReplyRead", () => {
    beforeEach(() => vi.clearAllMocks());

    it("only updates an inbound reply belonging to the caller's team", async () => {
        mockDb.message.updateMany.mockResolvedValue({ count: 0 });

        await expect(markReplyRead("team-a", "msg-from-team-b")).rejects.toMatchObject({ statusCode: 404 });
        expect(mockDb.message.updateMany).toHaveBeenCalledWith({
            where: { id: "msg-from-team-b", direction: "INBOUND", lead: { teamId: "team-a" } },
            data: { isRead: true },
        });
    });
});

describe("sendReply", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.message.findFirst.mockResolvedValue(inboundReply());
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mailbox-1", provider: "GOOGLE_WORKSPACE" });
        mockDb.user.findUnique.mockResolvedValue({ name: "Rep" });
        mockDb.message.create.mockResolvedValue({ id: "outbound-1" });
        mockDb.email.findUnique.mockResolvedValue(null);
        mockDb.email.findFirst.mockReset().mockResolvedValue(null);
        mockDb.email.create.mockResolvedValue({ createdAt: new Date("2026-11-25T11:00:00Z") });
        mockDb.$transaction.mockImplementation((fn: (tx: typeof mockDb) => unknown) => fn(mockDb));
        (isSuppressed as any).mockResolvedValue(false);
        (guardrailService.evaluate as any).mockResolvedValue({ isSafe: true, violations: [] });
        (sendViaGmailMailbox as any).mockResolvedValue({ success: true, deliveryProvider: "GMAIL_API", messageId: "<gm-1>", threadId: "thread-9", mailboxId: "mailbox-1" });
        (sendViaResendMailbox as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND", messageId: "re-1", mailboxId: "mailbox-1" });
        (sendViaSmtpMailbox as any).mockResolvedValue({ success: true, deliveryProvider: "SMTP", messageId: "<smtp-1>", mailboxId: "mailbox-1" });
    });

    const send = (content = "Tuesday works.\nTalk then") =>
        sendReply({ teamId: "team-a", userId: "user-1", messageId: "msg-1", content });

    it("stops an approved scheduled reply when the thread has a newer message", async () => {
        mockDb.message.findFirst.mockResolvedValueOnce(inboundReply()).mockResolvedValueOnce({ id: "newer" });
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mailbox-1", provider: "RESEND" });
        await expect(sendReply({ teamId: "team-a", userId: "user-1", messageId: "msg-1", content: "Approved", scheduledJobId: "job-1" }))
            .rejects.toMatchObject({ code: "THREAD_CHANGED" });
        expect(sendViaResendMailbox).not.toHaveBeenCalled();
    });

    it("stops a scheduled reply when the newer campaign send exists only as an Email", async () => {
        mockDb.message.findFirst.mockResolvedValueOnce(inboundReply()).mockResolvedValueOnce(null);
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mailbox-1", provider: "RESEND" });
        mockDb.email.findFirst.mockResolvedValueOnce({ id: "campaign-send" });

        await expect(sendReply({ teamId: "team-a", userId: "user-1", messageId: "msg-1", content: "Approved", scheduledJobId: "job-1" }))
            .rejects.toMatchObject({ code: "THREAD_CHANGED" });
        expect(mockDb.email.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
            leadId: "lead-1", campaign: { teamId: "team-a" },
            AND: [
                { OR: [{ idempotencyKey: null }, { idempotencyKey: { not: "inbox_reply_job-1" } }] },
                { OR: [{ trackingId: null }, { trackingId: { not: "job-1" } }] },
            ],
            OR: expect.arrayContaining([{ events: { some: { type: "SENT", createdAt: { gte: inboundReply().createdAt } } } }]),
        }) }));
        expect(sendViaResendMailbox).not.toHaveBeenCalled();
    });

    it("repairs a persisted scheduled send after the read update fails, without resending", async () => {
        mockDb.message.findFirst.mockResolvedValueOnce(inboundReply()).mockResolvedValueOnce(null);
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mailbox-1", provider: "RESEND" });
        mockDb.message.update.mockRejectedValueOnce(new Error("database write failed")).mockResolvedValueOnce({});
        const input = { teamId: "team-a", userId: "user-1", messageId: "msg-1", content: "Approved", scheduledJobId: "job-1" };

        await expect(sendReply(input)).rejects.toThrow("database write failed");
        mockDb.email.findUnique.mockResolvedValueOnce({ createdAt: new Date("2026-11-25T11:00:00Z") });
        mockDb.message.findFirst.mockResolvedValueOnce(inboundReply()).mockResolvedValueOnce(null);

        await expect(sendReply(input)).resolves.toEqual({ alreadySent: true });
        expect(sendViaResendMailbox).toHaveBeenCalledTimes(1);
        expect(mockDb.message.upsert).toHaveBeenLastCalledWith(expect.objectContaining({
            where: { id: "inbox_reply_job-1" },
            create: expect.objectContaining({ direction: "OUTBOUND", content: "Approved" }),
        }));
        expect(mockDb.message.update).toHaveBeenCalledTimes(2);
    });

    it("returns the latest cancelled schedule after its send key is cleared", async () => {
        const processAt = new Date("2026-11-25T12:00:00Z");
        mockDb.job.findFirst.mockResolvedValueOnce({ status: "cancelled", processAt, result: null });
        await expect(scheduledInboxReplyStatus("team-a", "msg-1")).resolves.toEqual({ status: "cancelled", sendAt: processAt });
        expect(mockDb.job.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.objectContaining({ OR: expect.arrayContaining([
                { status: "cancelled", result: { path: ["cancelledReplyId"], equals: "msg-1" } },
            ]) }),
        }));
    });

    it("reuses the job id across a scheduled reply's provider and database writes", async () => {
        mockDb.message.findFirst.mockResolvedValueOnce(inboundReply()).mockResolvedValueOnce(null);
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mailbox-1", provider: "RESEND" });
        await sendReply({ teamId: "team-a", userId: "user-1", messageId: "msg-1", content: "Approved", scheduledJobId: "job-1" });
        expect(sendViaResendMailbox).toHaveBeenCalledWith(expect.objectContaining({ trackingId: "job-1", idempotencyKey: "inbox_reply_job-1" }));
        expect(mockDb.email.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ idempotencyKey: "inbox_reply_job-1" }) }));
    });

    it("queues the approved reply encrypted and does not dispatch it before its scheduled time", async () => {
        const sendAt = new Date("2026-11-25T12:00:00Z");
        const encrypted = { v: 1, cipher: "ciphertext", iv: "iv", tag: "tag" };
        vi.mocked(encryptCredential).mockResolvedValue(encrypted);
        vi.mocked(JobQueue.enqueue).mockResolvedValue({ status: "queued", processAt: sendAt } as Awaited<ReturnType<typeof JobQueue.enqueue>>);
        const result = await scheduleInboxReply({ teamId: "team-a", userId: "user-1", messageId: "msg-1", content: "Approved", sendAt });

        expect(result).toEqual({ scheduled: true, sendAt, status: "queued" });
        expect(encryptCredential).toHaveBeenCalledWith(JSON.stringify({ content: "Approved", recipient: "lead@example.test" }));
        expect(JobQueue.enqueue).toHaveBeenCalledWith("scheduled_inbox_reply", { teamId: "team-a", userId: "user-1", messageId: "msg-1", approvedReply: encrypted },
            expect.objectContaining({ processAt: sendAt, idempotencyKey: "scheduled_inbox_reply:team-a:msg-1" }));
        expect(sendViaResendMailbox).not.toHaveBeenCalled();
    });

    it("404s for a reply outside the caller's team and sends nothing", async () => {
        mockDb.message.findFirst.mockResolvedValue(null);

        await expect(send()).rejects.toMatchObject({ statusCode: 404 });
        expect(mockDb.message.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "msg-1", direction: "INBOUND", lead: { teamId: "team-a" } },
        }));
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
    });

    it("refuses a suppressed recipient before any send", async () => {
        (isSuppressed as any).mockResolvedValue(true);

        await expect(send()).rejects.toMatchObject({ statusCode: 409, code: "RECIPIENT_SUPPRESSED" });
        expect(isSuppressed).toHaveBeenCalledWith("team-a", "lead@example.test");
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
        expect(mockDb.message.create).not.toHaveBeenCalled();
    });

    it("refuses content the team's guardrails block", async () => {
        (guardrailService.evaluate as any).mockResolvedValue({ isSafe: false, violations: [{ reason: "Blocked phrase" }] });

        await expect(send()).rejects.toMatchObject({ statusCode: 403 });
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
    });

    it("sends from the original Gmail mailbox, escaping the body, and records the Email and OUTBOUND Message", async () => {
        const message = await send("<b>Tuesday</b> works.\nTalk then");

        expect(mockDb.connectedMailbox.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: "mailbox-1", teamId: "team-a", status: "CONNECTED" },
        }));
        expect(sendViaGmailMailbox).toHaveBeenCalledWith({
            teamId: "team-a",
            mailboxId: "mailbox-1",
            to: "lead@example.test",
            subject: "Re: Quick question",
            html: "&lt;b&gt;Tuesday&lt;/b&gt; works.<br>Talk then",
            purpose: "conversation_reply",
        });
        expect(mockDb.email.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                leadId: "lead-1",
                campaignId: "campaign-1",
                mailboxId: "mailbox-1",
                providerId: "<gm-1>",
                threadId: "thread-9",
                idempotencyKey: expect.stringMatching(/^inbox_reply_/),
            }),
        });
        expect(mockDb.message.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ leadId: "lead-1", direction: "OUTBOUND", platform: "EMAIL", status: "sent", sender: "Rep" }),
        });
        expect(message).toEqual({ id: "outbound-1" });
    });

    it.each([
        ["RESEND", sendViaResendMailbox],
        ["SMTP", sendViaSmtpMailbox],
    ])("routes a %s mailbox's reply through that provider", async (provider, sender) => {
        mockDb.connectedMailbox.findFirst.mockResolvedValue({ id: "mailbox-1", provider });

        await send();

        expect(sender).toHaveBeenCalledWith(expect.objectContaining({ teamId: "team-a", mailboxId: "mailbox-1", subject: "Re: Quick question" }));
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
    });

    it("falls back to the lead's latest team email when the reply has no email event", async () => {
        mockDb.message.findFirst.mockResolvedValue(inboundReply({ emailEvent: null }));
        mockDb.email.findFirst.mockResolvedValue({ id: "email-2", subject: "Re: Intro", campaignId: "campaign-2", mailboxId: "mailbox-1" });

        await send();

        expect(mockDb.email.findFirst).toHaveBeenCalledWith(expect.objectContaining({
            where: { leadId: "lead-1", campaign: { teamId: "team-a" }, mailboxId: { not: null } },
        }));
        expect(sendViaGmailMailbox).toHaveBeenCalledWith(expect.objectContaining({ subject: "Re: Intro" }));
    });

    it("does not fall back to another mailbox when the original one is disconnected", async () => {
        mockDb.connectedMailbox.findFirst.mockResolvedValue(null);

        await expect(send()).rejects.toMatchObject({ statusCode: 409, code: "MAILBOX_UNAVAILABLE" });
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
    });

    it("does not record a sent message when the provider send fails", async () => {
        (sendViaGmailMailbox as any).mockResolvedValue({ success: false, error: "GMAIL_SEND_REJECTED", outcome: "EXPLICIT_REJECTION", fallbackAllowed: false });

        await expect(send()).rejects.toMatchObject({ statusCode: 502, code: "GMAIL_SEND_REJECTED" });
        expect(mockDb.email.create).not.toHaveBeenCalled();
        expect(mockDb.message.create).not.toHaveBeenCalled();
    });

    it("hands Instagram and Facebook replies to the social sender, without touching mailboxes", async () => {
        mockDb.message.findFirst.mockResolvedValue(inboundReply({ platform: "INSTAGRAM", emailEvent: null }));
        (sendSocialReply as any).mockResolvedValue({ id: "outbound-ig" });

        await expect(send("See you there")).resolves.toEqual({ id: "outbound-ig" });
        expect(sendSocialReply).toHaveBeenCalledWith({ teamId: "team-a", userId: "user-1", leadId: "lead-1", replyMessageId: "msg-1", platform: "INSTAGRAM", content: "See you there" });
        expect(mockDb.connectedMailbox.findFirst).not.toHaveBeenCalled();
        expect(sendViaGmailMailbox).not.toHaveBeenCalled();
    });

    it("rejects non-email replies", async () => {
        mockDb.message.findFirst.mockResolvedValue(inboundReply({ platform: "LINKEDIN" }));

        await expect(send()).rejects.toMatchObject({ statusCode: 400, code: "UNSUPPORTED_PLATFORM" });
    });
});

describe("markReplyOutcome", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.message.findFirst.mockResolvedValue(inboundReply());
        (SequenceService.stopEnrollmentsForLead as any).mockResolvedValue({ stopped: 1 });
    });

    it("404s for a reply outside the caller's team and changes nothing", async () => {
        mockDb.message.findFirst.mockResolvedValue(null);

        await expect(markReplyOutcome("team-a", "msg-from-team-b", "interested")).rejects.toMatchObject({ statusCode: 404 });
        expect(mockDb.lead.update).not.toHaveBeenCalled();
        expect(SequenceService.stopEnrollmentsForLead).not.toHaveBeenCalled();
    });

    it.each(["interested", "not_interested", "meeting_booked", "wrong_person"] as const)(
        "saves %s on the lead and stops its sequences",
        async (outcome) => {
            const result = await markReplyOutcome("team-a", "msg-1", outcome);

            expect(mockDb.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { replyOutcome: outcome } });
            expect(SequenceService.stopEnrollmentsForLead).toHaveBeenCalledWith("team-a", "lead-1", `EXIT_REPLY_${outcome.toUpperCase()}`);
            expect(result).toEqual({ leadId: "lead-1", outcome, stoppedEnrollments: 1 });
        }
    );

    it("moves meeting_booked and not_interested leads through the existing stage transitions", async () => {
        await markReplyOutcome("team-a", "msg-1", "meeting_booked");
        expect(advanceLeadAfterMeetingScheduled).toHaveBeenCalledWith(mockDb, { leadId: "lead-1", teamId: "team-a" });

        await markReplyOutcome("team-a", "msg-1", "not_interested");
        expect(advanceLeadToLost).toHaveBeenCalledWith(mockDb, { leadId: "lead-1", teamId: "team-a" });
    });
});

describe("markReplyDoNotContact", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDb.message.findFirst.mockResolvedValue(inboundReply());
        (SequenceService.stopEnrollmentsForLead as any).mockResolvedValue({ stopped: 2 });
    });

    it("404s for a reply outside the caller's team and suppresses nothing", async () => {
        mockDb.message.findFirst.mockResolvedValue(null);

        await expect(markReplyDoNotContact("team-a", "msg-from-team-b", "user-1")).rejects.toMatchObject({ statusCode: 404 });
        expect(recordSuppression).not.toHaveBeenCalled();
        expect(mockDb.lead.update).not.toHaveBeenCalled();
    });

    it("suppresses the lead's email for the team, then marks not_interested and stops sequences", async () => {
        const result = await markReplyDoNotContact("team-a", "msg-1", "user-1");

        expect(recordSuppression).toHaveBeenCalledWith({
            teamId: "team-a",
            email: "lead@example.test",
            reason: "UNSUBSCRIBE",
            source: "INBOX",
            leadId: "lead-1",
            createdBy: "user-1",
        });
        expect(mockDb.lead.update).toHaveBeenCalledWith({ where: { id: "lead-1" }, data: { replyOutcome: "not_interested" } });
        expect(advanceLeadToLost).toHaveBeenCalledWith(mockDb, { leadId: "lead-1", teamId: "team-a" });
        expect(SequenceService.stopEnrollmentsForLead).toHaveBeenCalledWith("team-a", "lead-1", "EXIT_REPLY_NOT_INTERESTED");
        expect(result).toEqual({ leadId: "lead-1", outcome: "not_interested", stoppedEnrollments: 2, suppressed: true });
    });

    it("refuses a lead with no email address without changing the outcome", async () => {
        mockDb.message.findFirst.mockResolvedValue(inboundReply({ lead: { email: null } }));

        await expect(markReplyDoNotContact("team-a", "msg-1", "user-1")).rejects.toMatchObject({ statusCode: 400 });
        expect(recordSuppression).not.toHaveBeenCalled();
        expect(mockDb.lead.update).not.toHaveBeenCalled();
    });
});
