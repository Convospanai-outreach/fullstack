import { prisma } from "@/lib/db";
import { DEFAULT_TIMEZONE, localDate, localDayRange, localHour } from "./localDay";
import { collectNeedsYou, type NeedsYouType } from "./needsYouService";
import { INBOX_URL } from "./inboundReplyNotifier";

// Daily Action Inbox digest. The worker calls runDailyDigest() once per clock hour; it
// only sends during the 08:00-08:59 local hour, and DigestLog's unique (userId, sentOn)
// claim keeps it to one email per user per day across restarts and both worker VMs.

export const DIGEST_LOCAL_HOUR = 8;
const SETTINGS_URL = "https://craftmyfunnel.live/settings/notifications";

export type DigestData = {
    recipientName: string | null;
    unreadReplies: { count: number; top: { leadName: string; snippet: string }[] };
    stalledLeads: { count: number; top: string[] };
    meetingsToday: { count: number; top: { title: string; startTime: Date }[] };
    yesterday: { emailsSent: number; replies: number; meetingsBooked: number };
};

export async function collectDigestData(teamIds: string[], recipientName: string | null, now = new Date()): Promise<DigestData> {
    const yesterday = localDayRange(now, -1);
    const inTeams = { in: teamIds };

    const [needsYou, emailsSent, replies, meetingsBooked] = await Promise.all([
        collectNeedsYou(teamIds, now),
        prisma.email.count({ where: { campaign: { teamId: inTeams }, createdAt: { gte: yesterday.start, lt: yesterday.end } } }),
        prisma.message.count({
            where: { direction: "INBOUND", lead: { teamId: inTeams }, createdAt: { gte: yesterday.start, lt: yesterday.end } },
        }),
        prisma.meeting.count({ where: { teamId: inTeams, createdAt: { gte: yesterday.start, lt: yesterday.end } } }),
    ]);
    const item = (type: NeedsYouType) => needsYou.find((entry) => entry.type === type)!;
    const unread = item("unread_replies");
    const stalled = item("stalled_leads");
    const meetings = item("meetings_today");

    return {
        recipientName,
        unreadReplies: {
            count: unread.count,
            top: unread.top.map((reply) => ({ leadName: reply.title, snippet: reply.detail ?? "" })),
        },
        stalledLeads: { count: stalled.count, top: stalled.top.map((nudge) => nudge.title) },
        meetingsToday: {
            count: meetings.count,
            top: meetings.top.map((meeting) => ({ title: meeting.title, startTime: new Date(meeting.at!) })),
        },
        yesterday: { emailsSent, replies, meetingsBooked },
    };
}

export function isDigestEmpty(data: DigestData) {
    return (
        data.unreadReplies.count === 0 &&
        data.stalledLeads.count === 0 &&
        data.meetingsToday.count === 0 &&
        data.yesterday.emailsSent === 0 &&
        data.yesterday.replies === 0 &&
        data.yesterday.meetingsBooked === 0
    );
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function plural(count: number, one: string, many: string) {
    return `${count} ${count === 1 ? one : many}`;
}

// Pure: every lead-, nudge- and meeting-supplied string is escaped here, since all of it
// is ultimately attacker-influenced (reply bodies, lead names, meeting titles).
export function renderDigestEmail(data: DigestData, timeZone = DEFAULT_TIMEZONE) {
    const time = new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit" });
    const headline = [
        data.unreadReplies.count ? plural(data.unreadReplies.count, "unread reply", "unread replies") : null,
        data.stalledLeads.count ? plural(data.stalledLeads.count, "stalled lead", "stalled leads") : null,
        data.meetingsToday.count ? plural(data.meetingsToday.count, "meeting today", "meetings today") : null,
    ].filter(Boolean);
    const subject = headline.length ? `Today: ${headline.join(", ")}` : "Your daily CraftMyFunnel summary";

    const section = (title: string, count: number, items: string[]) =>
        count === 0
            ? ""
            : `<tr><td style="padding:16px 0 0">
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a">${escapeHtml(title)} (${count})</p>
${items.map((item) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.45;color:#334155">${item}</p>`).join("\n")}
</td></tr>`;

    const replies = section(
        "Unread replies",
        data.unreadReplies.count,
        data.unreadReplies.top.map((reply) => `<strong>${escapeHtml(reply.leadName)}</strong>: ${escapeHtml(reply.snippet)}`)
    );
    const stalled = section("Stalled leads", data.stalledLeads.count, data.stalledLeads.top.map((suggestion) => escapeHtml(suggestion)));
    const meetings = section(
        "Meetings today",
        data.meetingsToday.count,
        data.meetingsToday.top.map((meeting) => `${escapeHtml(time.format(meeting.startTime))} &middot; ${escapeHtml(meeting.title)}`)
    );
    const y = data.yesterday;
    const yesterdayLine = `${plural(y.emailsSent, "email", "emails")} sent &middot; ${plural(y.replies, "reply", "replies")} &middot; ${plural(y.meetingsBooked, "meeting", "meetings")} booked`;
    const greeting = data.recipientName ? `Good morning, ${escapeHtml(data.recipientName)}.` : "Good morning.";

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
<p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#0f172a">${greeting}</p>
<p style="margin:0;font-size:14px;color:#475569">Here is what needs you today.</p>
</td></tr>
${replies}
${stalled}
${meetings}
<tr><td style="padding:16px 0 0">
<p style="margin:0 0 4px;font-size:15px;font-weight:600;color:#0f172a">Yesterday</p>
<p style="margin:0;font-size:14px;color:#334155">${yesterdayLine}</p>
</td></tr>
<tr><td style="padding:24px 0 8px">
<a href="${INBOX_URL}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 20px;border-radius:8px">Open your inbox</a>
</td></tr>
</table>
<p style="max-width:560px;margin:12px auto 0;font-size:12px;color:#64748b">You get this because the daily digest is on. <a href="${SETTINGS_URL}" style="color:#64748b">Turn it off in notification settings</a>.</p>
</td></tr></table>
</body></html>`;

    const textSection = (title: string, count: number, items: string[]) =>
        count === 0 ? [] : [`${title} (${count})`, ...items.map((item) => `- ${item}`), ""];
    const text = [
        data.recipientName ? `Good morning, ${data.recipientName}.` : "Good morning.",
        "",
        ...textSection("Unread replies", data.unreadReplies.count, data.unreadReplies.top.map((r) => `${r.leadName}: ${r.snippet}`)),
        ...textSection("Stalled leads", data.stalledLeads.count, data.stalledLeads.top),
        ...textSection("Meetings today", data.meetingsToday.count, data.meetingsToday.top.map((m) => `${time.format(m.startTime)} ${m.title}`)),
        `Yesterday: ${plural(y.emailsSent, "email", "emails")} sent, ${plural(y.replies, "reply", "replies")}, ${plural(y.meetingsBooked, "meeting", "meetings")} booked`,
        "",
        `Open your inbox: ${INBOX_URL}`,
    ].join("\n");

    return { subject, html, text };
}

export async function runDailyDigest(now = new Date()) {
    const result = { considered: 0, sent: 0, skippedEmpty: 0, failed: 0 };
    if (localHour(now) !== DIGEST_LOCAL_HOUR) return result;

    const apiKey = process.env["RESEND_API_KEY"];
    if (!apiKey) {
        console.warn("[Digest] RESEND_API_KEY is not set; skipping the daily digest.");
        return result;
    }
    const { Resend } = await import("resend");
    const { SYSTEM_EMAIL_FROM } = await import("@/lib/notifications");
    const resend = new Resend(apiKey);
    const sentOn = localDate(now);

    const users = await prisma.user.findMany({
        where: { memberships: { some: { status: "active" } } },
        select: {
            id: true,
            email: true,
            name: true,
            settings: { select: { notifications: { select: { emailGlobal: true, digestEnabled: true } } } },
            memberships: { where: { status: "active" }, select: { teamId: true } },
        },
    });

    for (const user of users) {
        // No NotificationSettings row means the defaults, i.e. opted in (same as NotificationDispatcher).
        const prefs = user.settings?.notifications;
        if (prefs && (!prefs.emailGlobal || !prefs.digestEnabled)) continue;
        result.considered++;

        try {
            const claimKey = { userId_sentOn: { userId: user.id, sentOn } };
            if (await prisma.digestLog.findUnique({ where: claimKey })) continue;

            const data = await collectDigestData(
                user.memberships.map((membership) => membership.teamId),
                user.name,
                now
            );
            if (isDigestEmpty(data)) {
                result.skippedEmpty++;
                continue;
            }

            try {
                await prisma.digestLog.create({ data: { userId: user.id, sentOn } });
            } catch (error: any) {
                if (error?.code === "P2002") continue; // another worker claimed this user today
                throw error;
            }

            const email = renderDigestEmail(data);
            const response = await resend.emails
                .send({ from: SYSTEM_EMAIL_FROM, to: user.email, subject: email.subject, html: email.html, text: email.text })
                .catch((error: unknown) => ({ error }));
            if (response?.error) {
                // Release the claim so a later run in the same hour (e.g. after a restart) can retry.
                await prisma.digestLog.delete({ where: claimKey }).catch(() => undefined);
                throw new Error("RESEND_SEND_FAILED");
            }
            result.sent++;
        } catch (error) {
            result.failed++;
            console.error(`[Digest] Failed for user ${user.id}:`, error instanceof Error ? error.message : error);
        }
    }

    return result;
}
