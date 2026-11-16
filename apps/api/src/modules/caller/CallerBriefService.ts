import { prisma } from "@/lib/db";

const TAKE = 30;

export type BriefTimelineItem = { at: Date; channel: string; kind: string; summary: string };

/**
 * Read-only call brief for the human caller: everything already known about a
 * lead, assembled from existing tables. Team-scoped; returns null if the lead
 * is not in the caller's team.
 */
export class CallerBriefService {
    static async getBrief(leadId: string, teamId: string) {
        const lead = await prisma.lead.findFirst({
            where: { id: leadId, teamId },
            select: {
                id: true, fullName: true, email: true, phone: true, whatsappNumber: true, linkedIn: true,
                company: true, domain: true, jobTitle: true, location: true, source: true,
                pipelineState: true, intentScore: true, icpFitScore: true, churnRisk: true,
                optimalSendHour: true, replyOutcome: true, enrichedData: true,
            },
        });
        if (!lead) return null;

        const [emails, links, activities, channels, whatsapp, messages, entries, meetings, threads, landingLeads] =
            await Promise.all([
                prisma.email.findMany({
                    where: { leadId }, orderBy: { createdAt: "desc" }, take: TAKE,
                    select: { subject: true, createdAt: true, openedAt: true, clickedAt: true, repliedAt: true, bouncedAt: true, campaign: { select: { name: true, ownerId: true } } },
                }),
                prisma.trackedLink.findMany({
                    where: { leadId, teamId, clickCount: { gt: 0 } }, orderBy: { lastClickedAt: "desc" }, take: TAKE,
                    select: { destinationUrl: true, clickCount: true, firstClickedAt: true, lastClickedAt: true },
                }),
                prisma.leadActivity.findMany({
                    where: { leadId }, orderBy: { createdAt: "desc" }, take: TAKE,
                    select: { channel: true, type: true, title: true, createdAt: true },
                }),
                prisma.leadChannelStatus.findMany({ where: { leadId }, select: { channel: true, status: true, lastActivityAt: true } }),
                prisma.whatsAppMessage.findMany({
                    where: { leadId }, orderBy: { createdAt: "desc" }, take: TAKE,
                    select: { body: true, direction: true, createdAt: true },
                }),
                prisma.message.findMany({
                    where: { leadId }, orderBy: { createdAt: "desc" }, take: TAKE,
                    select: { content: true, direction: true, platform: true, createdAt: true },
                }),
                prisma.conversationEntry.findMany({
                    where: { leadId }, orderBy: { createdAt: "desc" }, take: TAKE,
                    select: { role: true, content: true, createdAt: true },
                }),
                prisma.meeting.findMany({
                    where: { leadId, teamId }, orderBy: { startTime: "desc" }, take: 5,
                    select: { title: true, startTime: true, notes: true },
                }),
                prisma.conversationThread.findMany({ where: { leadId }, select: { id: true } }),
                lead.email
                    ? prisma.landingLead.findMany({
                          where: { teamId, email: { equals: lead.email, mode: "insensitive" } },
                          select: { sessionId: true, landingPage: { select: { title: true, slug: true } } },
                          take: 5,
                      })
                    : Promise.resolve([]),
            ]);

        // Earlier call notes: ConversationService.transitionState stores the caller's notes as the audit `reason`.
        const threadIds = threads.map((t) => t.id);
        const audits = threadIds.length
            ? await prisma.auditLog.findMany({
                  where: { orgId: teamId, action: "CONVERSATION_STATE_CHANGE", entity: "ConversationThread", entityId: { in: threadIds } },
                  orderBy: { createdAt: "desc" }, take: 20, select: { createdAt: true, metadata: true },
              })
            : [];
        const callNotes = audits
            .map((a) => ({ at: a.createdAt, reason: (a.metadata as { reason?: string } | null)?.reason ?? "" }))
            .filter((n) => n.reason && !n.reason.startsWith("Auto:") && !n.reason.startsWith("Claimed by"));

        const sessionIds = landingLeads.map((l) => l.sessionId).filter((s): s is string => !!s);
        const landingEvents = sessionIds.length
            ? await prisma.landingEvent.findMany({
                  where: { teamId, sessionId: { in: sessionIds } }, orderBy: { createdAt: "desc" }, take: 100,
                  select: { eventName: true },
              })
            : [];

        const timeline: BriefTimelineItem[] = [];
        for (const e of emails) {
            timeline.push({ at: e.createdAt, channel: "EMAIL", kind: "sent", summary: e.subject });
            if (e.openedAt) timeline.push({ at: e.openedAt, channel: "EMAIL", kind: "opened", summary: e.subject });
            if (e.clickedAt) timeline.push({ at: e.clickedAt, channel: "EMAIL", kind: "clicked", summary: e.subject });
            if (e.repliedAt) timeline.push({ at: e.repliedAt, channel: "EMAIL", kind: "replied", summary: e.subject });
            if (e.bouncedAt) timeline.push({ at: e.bouncedAt, channel: "EMAIL", kind: "bounced", summary: e.subject });
        }
        for (const a of activities) timeline.push({ at: a.createdAt, channel: a.channel, kind: a.type, summary: a.title });
        for (const w of whatsapp) timeline.push({ at: w.createdAt, channel: "WHATSAPP", kind: w.direction.toLowerCase(), summary: w.body.slice(0, 200) });
        for (const m of messages) timeline.push({ at: m.createdAt, channel: m.platform, kind: m.direction.toLowerCase(), summary: m.content.slice(0, 200) });
        timeline.sort((a, b) => b.at.getTime() - a.at.getTime());

        const { enrichedData, ...profile } = lead;
        const crystal =
            (enrichedData as { crystalKnows?: { guidance?: { prompt?: string; discType?: string; archetype?: string } } } | null)
                ?.crystalKnows?.guidance ?? null;

        const ownerIds = [...new Set(emails.map((e) => e.campaign?.ownerId).filter((x): x is string => !!x))];
        const owners = ownerIds.length
            ? await prisma.user.findMany({ where: { id: { in: ownerIds } }, select: { name: true, email: true } })
            : [];

        const count = (name: string) => landingEvents.filter((e) => e.eventName === name).length;
        return {
            lead: profile,
            crystal,
            outreach: {
                campaigns: [...new Set(emails.map((e) => e.campaign?.name).filter((n): n is string => !!n))],
                ranBy: owners,
                channels,
                emailsSent: emails.length,
                opened: emails.filter((e) => e.openedAt).length,
                clicked: emails.filter((e) => e.clickedAt).length,
                replied: emails.filter((e) => e.repliedAt).length,
            },
            engagement: {
                linkClicks: links,
                landing: {
                    pages: landingLeads.map((l) => l.landingPage?.title ?? l.landingPage?.slug ?? "landing page"),
                    pageViews: count("page_view"),
                    ctaClicks: count("cta_click"),
                    formSubmits: count("form_submit"),
                    // Downloads are not tracked as a distinct event, so none is claimed.
                    downloadTracked: false,
                },
            },
            timeline: timeline.slice(0, 40),
            conversation: entries,
            callNotes,
            meetings,
        };
    }
}
