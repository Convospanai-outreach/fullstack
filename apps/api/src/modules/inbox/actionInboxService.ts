import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { APIError } from "@/lib/apiResponse";
import { localDayRange } from "./localDay";
import { REPLY_WINDOW_MS, sendSocialReply } from "@/modules/creator-funnel/socialInbox";
import { getSuggestionsForReplies, type ReplySuggestion } from "./replySuggestions";

// Action Inbox: one team-scoped view of inbound replies, open Overseer nudges and
// upcoming meetings. Message has no teamId of its own, so every Message query here is
// scoped through its lead (lead.teamId).

export const REPLY_OUTCOMES = ["interested", "not_interested", "meeting_booked", "wrong_person"] as const;
export type ReplyOutcome = (typeof REPLY_OUTCOMES)[number];

const SNIPPET_LENGTH = 200;
// Tags the Email rows sendReply() writes, so the thread doesn't show them twice (their
// OUTBOUND Message row already carries the rep's plain text).
const INBOX_REPLY_KEY_PREFIX = "inbox_reply_";
const UPCOMING_MEETING_WINDOW_MS = 48 * 60 * 60 * 1000;

// Inbound content can be raw HTML (IMAP falls back to parsed.html), so strip it before
// showing it anywhere. Regex rather than an HTML parser: this only has to produce
// readable plain text, and every renderer escapes it again.
export function toPlainText(content: string) {
    return content
        .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
        .replace(/<br\s*\/?>|<\/(p|div|li|tr|h\d)>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&amp;/gi, "&")
        .replace(/[ \t\f\v]+/g, " ")
        .replace(/\s*\n\s*/g, "\n")
        .trim();
}

export function toSnippet(content: string) {
    return toPlainText(content).replace(/\s+/g, " ").slice(0, SNIPPET_LENGTH);
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

const inboundReplyWhere = (teamId: string) => ({ direction: "INBOUND", lead: { teamId } });

// Instagram/Facebook DMs (creator funnel, socialInbox.ts) can be answered for 24 hours after
// the person's last message.
const SOCIAL_PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;
const isSocialPlatform = (platform: string): platform is (typeof SOCIAL_PLATFORMS)[number] =>
    (SOCIAL_PLATFORMS as readonly string[]).includes(platform);

const inboxReplySelect = {
    id: true, leadId: true, content: true, platform: true, isRead: true, sentimentScore: true, createdAt: true,
    lead: { select: {
        fullName: true, company: true, email: true, replyOutcome: true,
        socialContacts: { orderBy: { lastInboundAt: "desc" }, take: 1, select: { handle: true, lastInboundAt: true } },
    } },
    emailEvent: { select: { email: { select: {
        subject: true, mailbox: { select: { teamId: true, status: true, provider: true } },
        campaign: { select: { name: true } },
        sequenceStepRuns: { take: 1, select: { enrollment: { select: { sequence: { select: { name: true } } } } } },
    } } } },
} as const satisfies Prisma.MessageSelect;

function mapInboxReply(teamId: string, reply: Prisma.MessageGetPayload<{ select: typeof inboxReplySelect }>, suggestion?: ReplySuggestion) {
    const email = reply.emailEvent?.email;
    const social = isSocialPlatform(reply.platform) ? reply.lead.socialContacts[0] : undefined;
    return {
        id: reply.id,
        leadId: reply.leadId,
        leadName: reply.lead.fullName,
        company: reply.lead.company,
        email: reply.lead.email,
        outcome: reply.lead.replyOutcome,
        platform: reply.platform,
        canScheduleReply: reply.platform === "EMAIL" && Boolean(reply.lead.email) && email?.mailbox?.teamId === teamId
            && email.mailbox.status === "CONNECTED" && email.mailbox.provider === "RESEND",
        subject: email?.subject ?? null,
        campaignName: email?.campaign?.name ?? null,
        sequenceName: email?.sequenceStepRuns[0]?.enrollment?.sequence?.name ?? null,
        snippet: toSnippet(reply.content),
        handle: social?.handle ?? null,
        replyWindowEndsAt: social?.lastInboundAt ? new Date(social.lastInboundAt.getTime() + REPLY_WINDOW_MS) : null,
        isRead: reply.isRead,
        sentimentScore: reply.sentimentScore,
        createdAt: reply.createdAt,
        suggestion: suggestion ?? null,
    };
}

export async function getInboxReply(teamId: string, id: string) {
    const reply = await prisma.message.findFirst({ where: { id, ...inboundReplyWhere(teamId) }, select: inboxReplySelect });
    if (!reply) return null;
    const suggestions = await getSuggestionsForReplies(teamId, [id]).catch(() => new Map<string, ReplySuggestion>());
    return mapInboxReply(teamId, reply, suggestions.get(id));
}

export async function getInboxCounts(teamId: string, now = new Date()) {
    const today = localDayRange(now);
    const [unreadReplies, openNudges, meetingsToday] = await Promise.all([
        prisma.message.count({ where: { ...inboundReplyWhere(teamId), isRead: false } }),
        prisma.overseerNudge.count({ where: { teamId, status: "OPEN" } }),
        prisma.meeting.count({ where: { teamId, startTime: { gte: today.start, lt: today.end } } }),
    ]);
    return { unreadReplies, openNudges, meetingsToday };
}

export async function getInbox(teamId: string, options: { page: number; limit: number }, now = new Date()) {
    const { page, limit } = options;
    const [replies, totalReplies, nudges, meetings, counts] = await Promise.all([
        prisma.message.findMany({
            where: inboundReplyWhere(teamId),
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: inboxReplySelect,
        }),
        prisma.message.count({ where: inboundReplyWhere(teamId) }),
        prisma.overseerNudge.findMany({
            where: { teamId, status: "OPEN" },
            orderBy: { createdAt: "desc" },
            take: 50,
        }),
        prisma.meeting.findMany({
            where: { teamId, startTime: { gte: now, lte: new Date(now.getTime() + UPCOMING_MEETING_WINDOW_MS) } },
            orderBy: { startTime: "asc" },
            select: {
                id: true,
                title: true,
                startTime: true,
                endTime: true,
                leadId: true,
                lead: { select: { fullName: true, company: true, email: true } },
            },
        }),
        getInboxCounts(teamId, now),
    ]);

    // Suggestions are an extra: a failure reading them must not hide the whole inbox.
    const suggestions = await getSuggestionsForReplies(teamId, replies.map((reply) => reply.id)).catch(
        () => new Map<string, ReplySuggestion>()
    );

    return {
        replies: {
            items: replies.map((reply) => mapInboxReply(teamId, reply, suggestions.get(reply.id))),
            page,
            limit,
            total: totalReplies,
        },
        nudges,
        meetings,
        counts,
    };
}

export async function getThread(teamId: string, leadId: string) {
    const lead = await prisma.lead.findFirst({
        where: { id: leadId, teamId },
        select: { id: true, fullName: true, company: true, email: true, jobTitle: true, status: true, replyOutcome: true },
    });
    if (!lead) throw new APIError("Lead not found", 404, "LEAD_NOT_FOUND");

    // Campaign/sequence sends only write Email rows (no Message), so the rep's own outbound
    // emails come from there; Message holds the inbound replies and inbox-sent replies.
    const [messages, emails] = await Promise.all([
        prisma.message.findMany({
            where: { leadId, status: { not: "draft" } },
            orderBy: { createdAt: "asc" },
            select: { id: true, direction: true, platform: true, sender: true, content: true, isRead: true, sentimentScore: true, createdAt: true },
        }),
        prisma.email.findMany({
            where: {
                leadId,
                campaign: { teamId },
                OR: [{ idempotencyKey: null }, { NOT: { idempotencyKey: { startsWith: INBOX_REPLY_KEY_PREFIX } } }],
            },
            orderBy: { createdAt: "asc" },
            select: { id: true, body: true, createdAt: true, mailbox: { select: { displayName: true, email: true } } },
        }),
    ]);

    const timeline = [
        ...messages.map(({ content, ...message }) => ({ ...message, text: toPlainText(content) })),
        ...emails.map((email) => ({
            id: `email-${email.id}`,
            direction: "OUTBOUND",
            platform: "EMAIL",
            sender: email.mailbox?.displayName || email.mailbox?.email || null,
            isRead: true,
            sentimentScore: null,
            createdAt: email.createdAt,
            text: toPlainText(email.body),
        })),
    ].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    return { lead, messages: timeline };
}

export async function markReplyRead(teamId: string, messageId: string) {
    const result = await prisma.message.updateMany({
        where: { id: messageId, ...inboundReplyWhere(teamId) },
        data: { isRead: true },
    });
    if (result.count === 0) throw new APIError("Reply not found", 404, "REPLY_NOT_FOUND");
}

async function findTeamReply(teamId: string, messageId: string) {
    const message = await prisma.message.findFirst({
        where: { id: messageId, ...inboundReplyWhere(teamId) },
        select: {
            id: true,
            leadId: true,
            platform: true,
            createdAt: true,
            lead: { select: { email: true, status: true, replyOutcome: true } },
            emailEvent: {
                select: {
                    email: { select: { id: true, subject: true, campaignId: true, mailboxId: true } },
                },
            },
        },
    });
    if (!message) throw new APIError("Reply not found", 404, "REPLY_NOT_FOUND");
    return message;
}

async function recordScheduledReply(
    input: { key: string; leadId: string; userId: string; messageId: string; content: string; sentAt: Date },
    repairing = false,
) {
    return prisma.$transaction(async (tx) => {
        // Older scheduled sends wrote outbound messages without a deterministic ID.
        const legacy = repairing ? await tx.message.findFirst({
            where: {
                leadId: input.leadId, direction: "OUTBOUND", platform: "EMAIL", status: "sent",
                content: input.content, createdAt: { gte: input.sentAt, lte: new Date(input.sentAt.getTime() + 60_000) },
            },
            select: { id: true },
        }) : null;
        const user = legacy ? null : await tx.user.findUnique({ where: { id: input.userId }, select: { name: true } });
        const message = legacy ?? await tx.message.upsert({
            where: { id: input.key },
            update: {},
            create: {
                id: input.key, leadId: input.leadId, content: input.content, createdAt: input.sentAt,
                direction: "OUTBOUND", platform: "EMAIL", sender: user?.name || "Me", status: "sent", isRead: true,
            },
        });
        await tx.message.update({ where: { id: input.messageId }, data: { isRead: true } });
        return message;
    });
}

// Sends through the mailbox that sent the original outbound email, via that provider's own
// send function. Deliberately not emailService.sendEmail: that refuses leads whose status
// is "replied" (exactly the state here), injects tracking/unsubscribe links, and falls back
// to another mailbox or the legacy SMTP config, which would break "reply from the same mailbox".
export async function sendReply(input: { teamId: string; userId: string; messageId: string; content: string; scheduledJobId?: string; expectedRecipient?: string }) {
    const { teamId, userId, messageId, content } = input;
    const reply = await findTeamReply(teamId, messageId);
    if (input.scheduledJobId && reply.platform !== "EMAIL") throw new APIError("The scheduled reply requires an email thread", 409, "REPLY_PLATFORM_CHANGED");
    if (isSocialPlatform(reply.platform)) {
        return sendSocialReply({ teamId, userId, leadId: reply.leadId, replyMessageId: reply.id, platform: reply.platform, content });
    }
    if (reply.platform !== "EMAIL") {
        throw new APIError("Only email replies can be answered from the inbox", 400, "UNSUPPORTED_PLATFORM");
    }
    const scheduledKey = input.scheduledJobId ? INBOX_REPLY_KEY_PREFIX + input.scheduledJobId : null;
    if (scheduledKey) {
        const priorSend = await prisma.email.findUnique({
            where: { idempotencyKey: scheduledKey, leadId: reply.leadId, campaign: { teamId } },
            select: { createdAt: true },
        });
        if (priorSend) {
            await recordScheduledReply({
                key: scheduledKey, leadId: reply.leadId, userId, messageId: reply.id, content, sentAt: priorSend.createdAt,
            }, true);
            return { alreadySent: true };
        }
    }

    const to = reply.lead.email;
    if (!to) throw new APIError("Lead has no email address", 400, "LEAD_EMAIL_MISSING");
    if (input.expectedRecipient && to.trim().toLowerCase() !== input.expectedRecipient) {
        throw new APIError("The recipient address changed after approval", 409, "RECIPIENT_CHANGED");
    }

    const { isSuppressed, sendViaGmailMailbox } = await import("@/modules/email-campaigner/service/googleMailboxService");
    if (await isSuppressed(teamId, to)) {
        throw new APIError("Recipient is on the suppression list", 409, "RECIPIENT_SUPPRESSED");
    }

    const { guardrailService } = await import("@/modules/governance/service/guardrailService");
    const validation = await guardrailService.evaluate(teamId, content);
    if (!validation.isSafe) {
        throw new APIError(validation.violations[0]?.reason || "Content blocked by guardrails", 403, "GUARDRAIL_BLOCKED");
    }

    // Resend replies can lack emailEventId (that create is best-effort), so fall back to the
    // lead's most recent outbound email in this team that has a mailbox.
    const original = reply.emailEvent?.email?.mailboxId
        ? reply.emailEvent.email
        : await prisma.email.findFirst({
              where: { leadId: reply.leadId, campaign: { teamId }, mailboxId: { not: null } },
              orderBy: { createdAt: "desc" },
              select: { id: true, subject: true, campaignId: true, mailboxId: true },
          });
    const mailbox = original?.mailboxId
        ? await prisma.connectedMailbox.findFirst({
              where: { id: original.mailboxId, teamId, status: "CONNECTED" },
              select: { id: true, provider: true },
          })
        : null;
    if (!original || !mailbox) {
        throw new APIError("The mailbox that sent the original email is not connected", 409, "MAILBOX_UNAVAILABLE");
    }

    if (scheduledKey && input.scheduledJobId) {
        if (mailbox.provider !== "RESEND" || !reply.emailEvent?.email?.mailboxId) {
            throw new APIError("The original Resend mailbox is required", 409, "MAILBOX_UNAVAILABLE");
        }
        if (["opt_out", "unsubscribed", "do_not_contact", "dnc", "bounced", "lost", "closed_lost", "stopped"].includes(reply.lead.status.toLowerCase())
            || ["not_interested", "wrong_person", "meeting_booked"].includes(reply.lead.replyOutcome ?? "")) {
            throw new APIError("The lead's current status blocks this scheduled reply", 409, "REPLY_BLOCKED");
        }
        const newer = await prisma.message.findFirst({ where: {
            id: { not: reply.id }, leadId: reply.leadId, platform: "EMAIL", createdAt: { gte: reply.createdAt },
            direction: { in: ["INBOUND", "OUTBOUND"] }, NOT: { status: "draft" },
        }, select: { id: true } });
        const newerEmail = newer ? null : await prisma.email.findFirst({
            where: {
                leadId: reply.leadId, campaign: { teamId },
                AND: [
                    { OR: [{ idempotencyKey: null }, { idempotencyKey: { not: scheduledKey } }] },
                    { OR: [{ trackingId: null }, { trackingId: { not: input.scheduledJobId } }] },
                ],
                OR: [
                    { createdAt: { gte: reply.createdAt }, status: { in: ["sent", "delivered", "opened", "clicked", "replied", "bounced", "complained", "unsubscribed"] } },
                    { events: { some: { type: "SENT", createdAt: { gte: reply.createdAt } } } },
                ],
            },
            select: { id: true },
        });
        if (newer || newerEmail) throw new APIError("A newer message is in this thread. Review it before replying.", 409, "THREAD_CHANGED");
    } else if (mailbox.provider === "RESEND") {
        const scheduled = await scheduledInboxReplyStatus(teamId, messageId);
        if (scheduled && ["queued", "pending", "running", "processing"].includes(scheduled.status)) {
            throw new APIError("Cancel the scheduled reply before sending manually", 409, "REPLY_ALREADY_SCHEDULED");
        }
    }

    const subject = /^re:/i.test(original.subject) ? original.subject : `Re: ${original.subject}`;
    const html = escapeHtml(content).replace(/\r?\n/g, "<br>");
    const trackingId = input.scheduledJobId || crypto.randomUUID();

    let outcome:
        | { success: true; messageId?: string; threadId?: string; deliveryProvider: "RESEND" | "SMTP" | "GMAIL_API" }
        | { success: false; error: string };
    if (mailbox.provider === "RESEND") {
        const { sendViaResendMailbox } = await import("@/modules/email-campaigner/service/resendMailboxService");
        outcome = await sendViaResendMailbox({ teamId, mailboxId: mailbox.id, to, subject, html, trackingId,
            ...(scheduledKey ? { idempotencyKey: scheduledKey } : {}) });
    } else if (mailbox.provider === "SMTP") {
        const { sendViaSmtpMailbox } = await import("@/modules/email-campaigner/service/smtpConfigService");
        outcome = await sendViaSmtpMailbox({ teamId, mailboxId: mailbox.id, to, subject, html });
    } else {
        outcome = await sendViaGmailMailbox({ teamId, mailboxId: mailbox.id, to, subject, html });
    }
    if (!outcome.success) throw new APIError("Failed to send reply", 502, outcome.error);

    // An Email row is what the reply-sync paths match the lead's next answer against
    // (IMAP by providerId, Gmail by threadId, Resend by trackingId), so persist one.
    const sentEmail = await prisma.email.create({
        data: {
            leadId: reply.leadId,
            campaignId: original.campaignId,
            mailboxId: mailbox.id,
            subject,
            body: html,
            status: "sent",
            deliveryProvider: outcome.deliveryProvider,
            trackingId,
            idempotencyKey: `${INBOX_REPLY_KEY_PREFIX}${trackingId}`,
            ...(outcome.messageId ? { providerId: outcome.messageId } : {}),
            ...(outcome.threadId ? { threadId: outcome.threadId } : {}),
        },
    });

    if (scheduledKey) {
        return recordScheduledReply({
            key: scheduledKey, leadId: reply.leadId, userId, messageId: reply.id, content, sentAt: sentEmail.createdAt,
        });
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    const message = await prisma.message.create({
        data: {
            leadId: reply.leadId,
            content,
            direction: "OUTBOUND",
            platform: "EMAIL",
            sender: user?.name || "Me",
            status: "sent",
            isRead: true,
        },
    });
    await prisma.message.update({ where: { id: reply.id }, data: { isRead: true } });
    return message;
}

export async function scheduleInboxReply(input: { teamId: string; userId: string; messageId: string; content: string; sendAt: Date }) {
    const reply = await findTeamReply(input.teamId, input.messageId);
    const mailboxId = reply.emailEvent?.email?.mailboxId;
    const mailbox = mailboxId ? await prisma.connectedMailbox.findFirst({ where: {
        id: mailboxId, teamId: input.teamId, status: "CONNECTED", provider: "RESEND",
    }, select: { id: true } }) : null;
    if (reply.platform !== "EMAIL" || !mailbox || !reply.lead.email) {
        throw new APIError("Scheduling requires a reply from a connected Resend mailbox", 409, "MAILBOX_UNAVAILABLE");
    }
    const { JobQueue } = await import("@/lib/queue");
    const { encryptCredential } = await import("@/lib/security/credentialVault");
    const approvedReply = await encryptCredential(JSON.stringify({ content: input.content, recipient: reply.lead.email.trim().toLowerCase() }));
    const job = await JobQueue.enqueue("scheduled_inbox_reply", {
        teamId: input.teamId, userId: input.userId, messageId: input.messageId, approvedReply,
    }, {
        teamId: input.teamId, processAt: input.sendAt, expiresAt: new Date(input.sendAt.getTime() + 12 * 3_600_000),
        idempotencyKey: `scheduled_inbox_reply:${input.teamId}:${input.messageId}`,
    });
    if (!["queued", "pending", "running", "processing"].includes(job.status)) {
        throw new APIError("This reply has already had a scheduled send. Check the Inbox before sending again.", 409, "REPLY_ALREADY_SCHEDULED");
    }
    return { scheduled: true, sendAt: job.processAt, status: job.status };
}

export async function scheduledInboxReplyStatus(teamId: string, messageId: string) {
    const job = await prisma.job.findFirst({
        where: { teamId, type: "scheduled_inbox_reply", OR: [
            { idempotencyKey: `scheduled_inbox_reply:${teamId}:${messageId}` },
            { status: "cancelled", result: { path: ["cancelledReplyId"], equals: messageId } },
        ] },
        orderBy: { createdAt: "desc" },
        select: { processAt: true, status: true, result: true },
    });
    const skipped = (job?.result as { skipped?: string } | null)?.skipped;
    return job ? { sendAt: job.processAt, status: skipped ? "skipped" : job.status } : null;
}

export async function cancelScheduledInboxReply(teamId: string, messageId: string) {
    const cancelled = await prisma.job.updateMany({ where: {
        teamId, type: "scheduled_inbox_reply", idempotencyKey: `scheduled_inbox_reply:${teamId}:${messageId}`, status: { in: ["queued", "pending"] },
    }, data: { status: "cancelled", completedAt: new Date(), idempotencyKey: null, payload: {}, result: { cancelledReplyId: messageId } } });
    if (!cancelled.count) throw new APIError("The scheduled reply is no longer waiting to send", 409, "REPLY_NOT_QUEUED");
}

// Stops the lead's sequences for every outcome, not only interested/meeting_booked: a
// not_interested or wrong_person lead must not keep getting follow-ups either.
export async function markReplyOutcome(teamId: string, messageId: string, outcome: ReplyOutcome) {
    const reply = await findTeamReply(teamId, messageId);
    const leadId = reply.leadId;

    await prisma.lead.update({ where: { id: leadId }, data: { replyOutcome: outcome } });

    const transitions = await import("@/lib/crm/leadStageTransitions");
    if (outcome === "meeting_booked") await transitions.advanceLeadAfterMeetingScheduled(prisma, { leadId, teamId });
    if (outcome === "not_interested") await transitions.advanceLeadToLost(prisma, { leadId, teamId });

    const { SequenceService } = await import("@/modules/email-campaigner/service/sequenceService");
    const { stopped } = await SequenceService.stopEnrollmentsForLead(teamId, leadId, `EXIT_REPLY_${outcome.toUpperCase()}`);

    await prisma.message.update({ where: { id: reply.id }, data: { isRead: true } });
    return { leadId, outcome, stoppedEnrollments: stopped };
}

// The rep's one click for "asked not to be contacted": adds the lead's email to the team
// suppression list (checked by campaign sends, sequence runs and inbox replies), then
// applies the not_interested outcome so the lead is closed and its sequences stop.
export async function markReplyDoNotContact(teamId: string, messageId: string, userId: string) {
    const reply = await findTeamReply(teamId, messageId);
    const email = reply.lead.email;
    if (!email) throw new APIError("Lead has no email address to suppress", 400, "LEAD_EMAIL_MISSING");

    const { recordSuppression } = await import("@/modules/email-campaigner/service/googleMailboxService");
    await recordSuppression({ teamId, email, reason: "UNSUBSCRIBE", source: "INBOX", leadId: reply.leadId, createdBy: userId });

    const result = await markReplyOutcome(teamId, messageId, "not_interested");
    return { ...result, suppressed: true };
}
