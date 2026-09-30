import { prisma } from "@/lib/db";
import { localDayRange } from "./localDay";
import { toSnippet } from "./actionInboxService";

// "Needs you": the things waiting on a person right now, each with its top few entries and
// a link to act on them. Shared by the Home page (GET /dashboard/needs-you) and the daily
// digest, so both always count the same things the same way.

export const NEEDS_YOU_TOP_N = 3;

export type NeedsYouType =
    | "unread_replies"
    | "approvals"
    | "approved_not_sent"
    | "stalled_leads"
    | "mailbox_issues"
    | "meetings_today";

export interface NeedsYouEntry {
    id: string;
    title: string;
    detail: string | null;
    href: string;
    at: string | null;
}

export interface NeedsYouItem {
    type: NeedsYouType;
    count: number;
    top: NeedsYouEntry[];
    href: string;
}

// The approval flow (apps/web api/approvals/[id]) moves an approved draft to lowercase
// "queued" and then sends it; one still "queued" was approved but never went out.
// Campaign sends use uppercase "QUEUED" and are not counted here.
const APPROVED_NOT_SENT_STATUS = "queued";
// Mailboxes the sync marked as needing the user to reconnect them.
const MAILBOX_NEEDS_RECONNECT = "NEEDS_RECONNECT";

function formatAction(action: string) {
    return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function collectNeedsYou(teamIds: string[], now = new Date()): Promise<NeedsYouItem[]> {
    const inTeams = { in: teamIds };
    const today = localDayRange(now, 0);
    const unreadWhere = { direction: "INBOUND", isRead: false, lead: { teamId: inTeams } };
    const approvalsWhere = { teamId: inTeams, status: "PENDING" };
    const approvedWhere = { lead: { teamId: inTeams }, status: APPROVED_NOT_SENT_STATUS };
    const nudgesWhere = { teamId: inTeams, status: "OPEN" };
    const mailboxWhere = { teamId: inTeams, status: MAILBOX_NEEDS_RECONNECT };
    const meetingsWhere = { teamId: inTeams, startTime: { gte: today.start, lt: today.end } };
    const take = NEEDS_YOU_TOP_N;

    const [
        unreadCount, unreadTop,
        approvalCount, approvalTop,
        approvedCount, approvedTop,
        nudgeCount, nudgeTop,
        mailboxCount, mailboxTop,
        meetingCount, meetingTop,
    ] = await Promise.all([
        prisma.message.count({ where: unreadWhere }),
        prisma.message.findMany({
            where: unreadWhere,
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, content: true, createdAt: true, lead: { select: { fullName: true, email: true } } },
        }),
        prisma.approvalRequest.count({ where: approvalsWhere }),
        prisma.approvalRequest.findMany({
            where: approvalsWhere,
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, actionType: true, payload: true, createdAt: true },
        }),
        prisma.email.count({ where: approvedWhere }),
        prisma.email.findMany({
            where: approvedWhere,
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, subject: true, leadId: true, createdAt: true, lead: { select: { fullName: true, email: true } } },
        }),
        prisma.overseerNudge.count({ where: nudgesWhere }),
        prisma.overseerNudge.findMany({
            where: nudgesWhere,
            orderBy: { createdAt: "desc" },
            take,
            select: { id: true, suggestion: true, leadId: true, createdAt: true },
        }),
        prisma.connectedMailbox.count({ where: mailboxWhere }),
        prisma.connectedMailbox.findMany({
            where: mailboxWhere,
            take,
            select: { id: true, email: true, displayName: true },
        }),
        prisma.meeting.count({ where: meetingsWhere }),
        prisma.meeting.findMany({
            where: meetingsWhere,
            orderBy: { startTime: "asc" },
            take,
            select: { id: true, title: true, startTime: true },
        }),
    ]);

    return [
        {
            type: "unread_replies",
            count: unreadCount,
            href: "/inbox",
            top: unreadTop.map((reply) => ({
                id: reply.id,
                title: reply.lead.fullName || reply.lead.email || "Unknown lead",
                detail: toSnippet(reply.content),
                href: `/inbox?reply=${encodeURIComponent(reply.id)}`,
                at: reply.createdAt.toISOString(),
            })),
        },
        {
            type: "approvals",
            count: approvalCount,
            href: "/inbox?tab=approvals",
            top: approvalTop.map((request) => {
                const subject = (request.payload as { subject?: unknown } | null)?.subject;
                return {
                    id: request.id,
                    title: formatAction(request.actionType),
                    detail: typeof subject === "string" ? subject : null,
                    href: "/inbox?tab=approvals",
                    at: request.createdAt.toISOString(),
                };
            }),
        },
        {
            type: "approved_not_sent",
            count: approvedCount,
            href: "/campaigns",
            top: approvedTop.map((email) => ({
                id: email.id,
                title: email.lead?.fullName || email.lead?.email || "Unknown lead",
                detail: email.subject,
                href: email.leadId ? `/leads/${encodeURIComponent(email.leadId)}` : "/campaigns",
                at: email.createdAt.toISOString(),
            })),
        },
        {
            type: "stalled_leads",
            count: nudgeCount,
            href: "/inbox?tab=approvals",
            top: nudgeTop.map((nudge) => ({
                id: nudge.id,
                title: nudge.suggestion,
                detail: null,
                href: nudge.leadId ? `/leads/${encodeURIComponent(nudge.leadId)}` : "/inbox?tab=approvals",
                at: nudge.createdAt.toISOString(),
            })),
        },
        {
            type: "mailbox_issues",
            count: mailboxCount,
            href: "/settings/mailboxes",
            top: mailboxTop.map((mailbox) => ({
                id: mailbox.id,
                title: mailbox.displayName || mailbox.email,
                detail: mailbox.displayName ? mailbox.email : null,
                href: "/settings/mailboxes",
                at: null,
            })),
        },
        {
            type: "meetings_today",
            count: meetingCount,
            href: "/calendar",
            top: meetingTop.map((meeting) => ({
                id: meeting.id,
                title: meeting.title,
                detail: null,
                href: "/calendar",
                at: meeting.startTime.toISOString(),
            })),
        },
    ];
}
