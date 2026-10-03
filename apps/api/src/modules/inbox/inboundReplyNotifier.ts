import { prisma } from "@/lib/db";

// Real-time alerts for the two high-value inbox events: a new inbound reply and a new
// meeting. Callers fire these with `void`, after their own write has committed; both
// swallow their own errors so a notification failure can never change what the caller
// returns.

export const INBOX_URL = "https://craftmyfunnel.live/inbox";
const REPLY_ALERT_DEDUPE_MS = 6 * 60 * 60 * 1000;
const MIN_ALERT_SENTIMENT = 0.3;

// NotificationDispatcher puts `message` into the email HTML as-is, so only fixed text goes
// there; lead-controlled values (name, meeting title) are confined to the title, which is
// only ever used as a plain-text subject / in-app string.
const ALERT_MESSAGE = `Open your Action Inbox to read and respond: ${INBOX_URL}`;

// Reply alerts link to the exact thread. The message id is a server-generated uuid, URL-encoded.
function threadUrl(messageId: string) {
    return `${INBOX_URL}?reply=${encodeURIComponent(messageId)}`;
}

function plainTitle(value: string) {
    return value.replace(/[\r\n]+/g, " ").trim().slice(0, 120);
}

async function activeTeamUserIds(teamId: string) {
    const members = await prisma.teamMember.findMany({
        where: { teamId, status: "active", userId: { not: null } },
        select: { userId: true },
    });
    return members.map((member) => member.userId as string);
}

type InboundReply = {
    id: string;
    leadId: string;
    sentimentScore?: number | null;
    emailEventId?: string | null;
    createdAt: Date;
};

export async function onInboundReply(message: InboundReply) {
    // Queue the AI reply suggestion first: it is independent of the alert's sentiment/dedupe
    // early returns. It swallows its own errors.
    // Run side by side so a slow enqueue never delays the alert.
    await Promise.all([
        (async () => {
            try {
                const { enqueueReplyClassification } = await import("./replyClassificationService");
                await enqueueReplyClassification(message);
            } catch (error) {
                console.error("[InboxAlerts] Reply classification enqueue failed:", error instanceof Error ? error.message : error);
            }
        })(),
        (async () => {
            try {
                await notifyInboundReply(message);
            } catch (error) {
                console.error("[InboxAlerts] Reply alert failed:", error instanceof Error ? error.message : error);
            }
        })(),
    ]);
}

async function notifyInboundReply(message: InboundReply) {
    if (message.sentimentScore != null && message.sentimentScore < MIN_ALERT_SENTIMENT) return;

    const lead = await prisma.lead.findUnique({
        where: { id: message.leadId },
        select: { fullName: true, email: true, teamId: true },
    });
    if (!lead?.teamId) return;

    // At most one alert per lead per 6h: skip if this lead already replied within the
    // 6h before this message (that earlier reply is the one that alerted, or was itself
    // inside an earlier reply's window).
    const earlierReplies = await prisma.message.count({
        where: {
            leadId: message.leadId,
            direction: "INBOUND",
            id: { not: message.id },
            createdAt: { gte: new Date(message.createdAt.getTime() - REPLY_ALERT_DEDUPE_MS), lte: message.createdAt },
        },
    });
    if (earlierReplies > 0) return;

    // Alert the rep assigned to the receiving mailbox when there is one; otherwise the whole team.
    const teamUserIds = await activeTeamUserIds(lead.teamId);
    let recipients = teamUserIds;
    if (message.emailEventId) {
        const event = await prisma.emailEvent.findUnique({
            where: { id: message.emailEventId },
            select: { mailbox: { select: { assignedUserId: true } } },
        });
        const assigned = event?.mailbox?.assignedUserId;
        if (assigned && teamUserIds.includes(assigned)) recipients = [assigned];
    }

    const { NotificationDispatcher } = await import("@/lib/notifications");
    const title = plainTitle(`New reply from ${lead.fullName || lead.email || "a lead"}`);
    const url = threadUrl(message.id);
    for (const userId of recipients) {
        await NotificationDispatcher.send(userId, "LEAD", title, `Open the thread to read and respond: ${url}`, { leadId: message.leadId, messageId: message.id });
    }

    const { sendSlackAlerts, slackEscape } = await import("./slackAlert");
    await sendSlackAlerts(recipients, `*${slackEscape(title)}*  <${url}|Open the thread>`);
}

type CreatedMeeting = { id: string; teamId: string; title: string; leadId: string | null };

// The rep who created the meeting already knows about it, so only the rest of the team is alerted.
export async function onMeetingCreated(meeting: CreatedMeeting, createdByUserId: string | null) {
    try {
        await notifyMeetingCreated(meeting, createdByUserId);
    } catch (error) {
        console.error("[InboxAlerts] Meeting alert failed:", error instanceof Error ? error.message : error);
    }
}

async function notifyMeetingCreated(meeting: CreatedMeeting, createdByUserId: string | null) {
    const recipients = (await activeTeamUserIds(meeting.teamId)).filter((userId) => userId !== createdByUserId);
    if (recipients.length === 0) return;

    const { NotificationDispatcher } = await import("@/lib/notifications");
    const title = plainTitle(`Meeting booked: ${meeting.title}`);
    for (const userId of recipients) {
        await NotificationDispatcher.send(userId, "LEAD", title, ALERT_MESSAGE, { meetingId: meeting.id, leadId: meeting.leadId });
    }
}
