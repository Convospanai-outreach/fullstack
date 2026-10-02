import { prisma } from "@/lib/db";
import { DEFAULT_TIMEZONE, localDate, localDayRange, localHour, localMonth } from "./localDay";
import { collectNeedsYou, type NeedsYouType } from "./needsYouService";
import { meetingPace } from "./meetingGoalService";
import { INBOX_URL } from "./inboundReplyNotifier";

// Daily Action Inbox digest. The worker calls runDailyDigest() once per clock hour; it
// only sends during the 08:00-08:59 local hour, and DigestLog's unique (userId, sentOn)
// claim keeps it to one email per user per day across restarts and both worker VMs.
// Order: what needs you (top 3, deep-linked), meeting-goal pace, one win, yesterday.

export const DIGEST_LOCAL_HOUR = 8;
const APP_URL = "https://craftmyfunnel.live";
const SETTINGS_URL = `${APP_URL}/settings/notifications`;
const DIGEST_SECTIONS = 3;
// Reply outcomes (set in the Action Inbox) that count as a win.
const WINNING_OUTCOMES = ["interested", "meeting_booked"];

// Same labels as Home's Needs you card; one/many build the subject line.
const NEEDS_YOU_COPY: Record<NeedsYouType, { label: string; one: string; many: string }> = {
    unread_replies: { label: "Replies to answer", one: "unread reply", many: "unread replies" },
    approvals: { label: "Waiting for your approval", one: "approval waiting", many: "approvals waiting" },
    approved_not_sent: { label: "Approved but not sent", one: "approved draft not sent", many: "approved drafts not sent" },
    stalled_leads: { label: "Leads gone quiet", one: "stalled lead", many: "stalled leads" },
    mailbox_issues: { label: "Mailboxes to reconnect", one: "mailbox to reconnect", many: "mailboxes to reconnect" },
    meetings_today: { label: "Meetings today", one: "meeting today", many: "meetings today" },
};

type DigestEntry = { title: string; detail: string | null; href: string; at: Date | null };

export type DigestData = {
    recipientName: string | null;
    /** The most urgent non-empty Needs you items, in Home's order. hrefs are app paths. */
    needsYou: { type: NeedsYouType; count: number; href: string; top: DigestEntry[] }[];
    /** One line per team with a monthly meeting goal. teamName is set only for multi-team users. */
    goals: { teamName: string | null; goal: number; booked: number; behindBy: number }[];
    win: string | null;
    yesterday: { emailsSent: number; replies: number; meetingsBooked: number };
};

async function collectGoals(teamIds: string[], now: Date): Promise<DigestData["goals"]> {
    const teams = await prisma.team.findMany({
        where: { id: { in: teamIds }, monthlyMeetingGoal: { not: null } },
        select: { id: true, name: true, monthlyMeetingGoal: true },
    });
    const month = localMonth(now);
    return Promise.all(
        teams.map(async (team) => {
            const goal = team.monthlyMeetingGoal!;
            const booked = await prisma.meeting.count({ where: { teamId: team.id, createdAt: { gte: month.start, lt: month.end } } });
            const { behindBy } = meetingPace(goal, booked, month.dayOfMonth, month.daysInMonth);
            return { teamName: teamIds.length > 1 ? team.name : null, goal, booked, behindBy };
        })
    );
}

function leadLabel(lead: { fullName: string | null; email: string | null; company: string | null } | null | undefined) {
    const name = lead?.fullName || lead?.email;
    if (!name) return null;
    return lead?.company ? `${name} (${lead.company})` : name;
}

// Yesterday's best news: a booked meeting, else a reply the rep marked as interested.
async function collectWin(teamIds: string[], yesterday: { start: Date; end: Date }) {
    const lead = { select: { fullName: true, email: true, company: true } };
    const meeting = await prisma.meeting.findFirst({
        where: { teamId: { in: teamIds }, createdAt: { gte: yesterday.start, lt: yesterday.end } },
        orderBy: { createdAt: "desc" },
        select: { title: true, lead },
    });
    if (meeting) {
        const who = leadLabel(meeting.lead);
        return who ? `Meeting booked with ${who}` : `Meeting booked: ${meeting.title}`;
    }

    const reply = await prisma.message.findFirst({
        where: {
            direction: "INBOUND",
            createdAt: { gte: yesterday.start, lt: yesterday.end },
            lead: { teamId: { in: teamIds }, replyOutcome: { in: WINNING_OUTCOMES } },
        },
        orderBy: { createdAt: "desc" },
        select: { lead },
    });
    const who = leadLabel(reply?.lead);
    return who ? `${who} replied and is interested` : null;
}

export async function collectDigestData(teamIds: string[], recipientName: string | null, now = new Date()): Promise<DigestData> {
    const yesterday = localDayRange(now, -1);
    const inTeams = { in: teamIds };

    const [needsYou, goals, win, emailsSent, replies, meetingsBooked] = await Promise.all([
        collectNeedsYou(teamIds, now),
        collectGoals(teamIds, now),
        collectWin(teamIds, yesterday),
        prisma.email.count({ where: { campaign: { teamId: inTeams }, createdAt: { gte: yesterday.start, lt: yesterday.end } } }),
        prisma.message.count({
            where: { direction: "INBOUND", lead: { teamId: inTeams }, createdAt: { gte: yesterday.start, lt: yesterday.end } },
        }),
        prisma.meeting.count({ where: { teamId: inTeams, createdAt: { gte: yesterday.start, lt: yesterday.end } } }),
    ]);

    return {
        recipientName,
        needsYou: needsYou
            .filter((item) => item.count > 0)
            .slice(0, DIGEST_SECTIONS)
            .map((item) => ({
                type: item.type,
                count: item.count,
                href: item.href,
                top: item.top.map((entry) => ({ title: entry.title, detail: entry.detail, href: entry.href, at: entry.at ? new Date(entry.at) : null })),
            })),
        goals,
        win,
        yesterday: { emailsSent, replies, meetingsBooked },
    };
}

// A goal line alone doesn't justify an email; something has to need you or have happened.
export function isDigestEmpty(data: DigestData) {
    return (
        data.needsYou.length === 0 &&
        !data.win &&
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

function goalLine(goal: DigestData["goals"][number]) {
    const pace = goal.behindBy === 0 ? "On pace" : `Behind by ${goal.behindBy}`;
    const prefix = goal.teamName ? `${goal.teamName}: ` : "";
    return `${prefix}${goal.booked} of ${goal.goal} meetings booked this month. ${pace}.`;
}

// Pure: every lead-, nudge-, meeting- and team-supplied string is escaped here, since most
// of it is ultimately attacker-influenced (reply bodies, lead names, meeting titles).
export function renderDigestEmail(data: DigestData, timeZone = DEFAULT_TIMEZONE) {
    const time = new Intl.DateTimeFormat("en-IN", { timeZone, hour: "numeric", minute: "2-digit" });
    const entryTitle = (type: NeedsYouType, entry: DigestEntry) =>
        type === "meetings_today" && entry.at ? `${time.format(entry.at)} · ${entry.title}` : entry.title;
    const headline = data.needsYou.map((item) => plural(item.count, NEEDS_YOU_COPY[item.type].one, NEEDS_YOU_COPY[item.type].many));
    const subject = headline.length ? `Today: ${headline.join(", ")}` : "Your daily CraftMyFunnel summary";

    const block = (title: string, body: string) => `<tr><td style="padding:16px 0 0">
<p style="margin:0 0 8px;font-size:15px;font-weight:600;color:#0f172a">${title}</p>
${body}
</td></tr>`;
    const line = (html: string) => `<p style="margin:0 0 8px;font-size:14px;line-height:1.45;color:#334155">${html}</p>`;
    const link = (href: string, html: string) => `<a href="${escapeHtml(APP_URL + href)}" style="color:#4f46e5;text-decoration:none">${html}</a>`;

    const needsYouHtml = data.needsYou
        .map((item) => {
            const entries = item.top.map((entry) =>
                line(`${link(entry.href, `<strong>${escapeHtml(entryTitle(item.type, entry))}</strong>`)}${entry.detail ? `: ${escapeHtml(entry.detail)}` : ""}`)
            );
            if (item.count > item.top.length) entries.push(line(link(item.href, `See all ${item.count}`)));
            return block(`${escapeHtml(NEEDS_YOU_COPY[item.type].label)} (${item.count})`, entries.join("\n"));
        })
        .join("\n");
    const goalsHtml = data.goals.length ? block("Monthly meeting goal", data.goals.map((goal) => line(escapeHtml(goalLine(goal)))).join("\n")) : "";
    const winHtml = data.win ? block("Yesterday&#39;s win", line(escapeHtml(data.win))) : "";
    const y = data.yesterday;
    const yesterdayLine = `${plural(y.emailsSent, "email", "emails")} sent &middot; ${plural(y.replies, "reply", "replies")} &middot; ${plural(y.meetingsBooked, "meeting", "meetings")} booked`;
    const greeting = data.recipientName ? `Good morning, ${escapeHtml(data.recipientName)}.` : "Good morning.";
    const intro = data.needsYou.length ? "Here is what needs you today." : "Nothing is waiting on you today.";

    const html = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:24px">
<tr><td>
<p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#0f172a">${greeting}</p>
<p style="margin:0;font-size:14px;color:#475569">${intro}</p>
</td></tr>
${needsYouHtml}
${goalsHtml}
${winHtml}
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

    const text = [
        data.recipientName ? `Good morning, ${data.recipientName}.` : "Good morning.",
        "",
        ...data.needsYou.flatMap((item) => [
            `${NEEDS_YOU_COPY[item.type].label} (${item.count})`,
            ...item.top.map((entry) => `- ${entryTitle(item.type, entry)}${entry.detail ? `: ${entry.detail}` : ""} ${APP_URL}${entry.href}`),
            "",
        ]),
        ...data.goals.map(goalLine),
        ...(data.goals.length ? [""] : []),
        ...(data.win ? [`Yesterday's win: ${data.win}`, ""] : []),
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
