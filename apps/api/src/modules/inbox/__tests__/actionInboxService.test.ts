import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDb: any = vi.hoisted(() => ({
    message: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), updateMany: vi.fn(), update: vi.fn(), create: vi.fn() },
    overseerNudge: { findMany: vi.fn(), count: vi.fn() },
    meeting: { findMany: vi.fn(), count: vi.fn() },
    lead: { findFirst: vi.fn(), update: vi.fn() },
    email: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
    connectedMailbox: { findFirst: vi.fn() },
    user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/db", () => ({ prisma: mockDb }));
vi.mock("@/modules/email-campaigner/service/googleMailboxService", () => ({
    isSuppressed: vi.fn(),
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
vi.mock("@/lib/crm/leadStageTransitions", () => ({
    advanceLeadAfterMeetingScheduled: vi.fn(),
    advanceLeadToLost: vi.fn(),
}));

import {
    getInbox,
    getThread,
    markReplyOutcome,
    markReplyRead,
    sendReply,
    toSnippet,
} from "../actionInboxService";
import { isSuppressed, sendViaGmailMailbox } from "@/modules/email-campaigner/service/googleMailboxService";
import { sendViaResendMailbox } from "@/modules/email-campaigner/service/resendMailboxService";
import { sendViaSmtpMailbox } from "@/modules/email-campaigner/service/smtpConfigService";
import { guardrailService } from "@/modules/governance/service/guardrailService";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";
import { advanceLeadAfterMeetingScheduled, advanceLeadToLost } from "@/lib/crm/leadStageTransitions";

function inboundReply(overrides: any = {}) {
    return {
        id: "msg-1",
        leadId: "lead-1",
        platform: "EMAIL",
        lead: { email: "lead@example.test" },
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
        (isSuppressed as any).mockResolvedValue(false);
        (guardrailService.evaluate as any).mockResolvedValue({ isSafe: true, violations: [] });
        (sendViaGmailMailbox as any).mockResolvedValue({ success: true, deliveryProvider: "GMAIL_API", messageId: "<gm-1>", threadId: "thread-9", mailboxId: "mailbox-1" });
        (sendViaResendMailbox as any).mockResolvedValue({ success: true, deliveryProvider: "RESEND", messageId: "re-1", mailboxId: "mailbox-1" });
        (sendViaSmtpMailbox as any).mockResolvedValue({ success: true, deliveryProvider: "SMTP", messageId: "<smtp-1>", mailboxId: "mailbox-1" });
    });

    const send = (content = "Tuesday works.\nTalk then") =>
        sendReply({ teamId: "team-a", userId: "user-1", messageId: "msg-1", content });

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
