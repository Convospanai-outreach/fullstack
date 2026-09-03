import { NextResponse } from 'next/server';
import { getCurrentContext } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { ApprovalService } from "@/modules/governance/ApprovalService";

export const dynamic = "force-dynamic";

async function resolveTeamId() {
  const context = await getCurrentContext();
  if (context.teamId) return context.teamId;

  const clerkUser = await findOrCreateClerkAppUser();
  return clerkUser?.memberships.find((member) => member.status === "active")?.teamId || null;
}

export async function GET() {
  try {
    const { prisma } = await import("@/lib/db");
    const context = await getCurrentContext();
    const teamId = await resolveTeamId();
    const userId = context.userId || "system";
    
    if (!teamId) {
      return NextResponse.json({
        kpis: {
          meetingsBooked: 0,
          meetingsDelta: 0,
          activeLeads: 0,
          draftsReady: 0,
          draftsPendingSend: 0,
          openRatePct: 0,
          openRateDelta: 0,
        },
        workflow: {
          leadsImported: false,
          leadsCount: 0,
          draftsGenerated: false,
          draftsCount: 0,
          followUpsReviewed: false,
          followUpsCount: 0,
          pendingSendCount: 0,
        },
        recentActivity: [],
        recentLeads: [],
        pipelineTrend: [],
        setupPercent: 0,
      });
    }

    // Self-healing: Backfill orphaned drafts into ApprovalRequests automatically
    const existingApprovals = await prisma.approvalRequest.findMany({
      where: { teamId },
      select: { entityId: true, payload: true },
    });

    const existingEmailIds = new Set<string>();
    for (const a of existingApprovals) {
      if (a.entityId) existingEmailIds.add(a.entityId);
      const payloadEmailId = (a.payload as any)?.emailId;
      if (payloadEmailId) existingEmailIds.add(payloadEmailId);
    }

    const draftEmails = await prisma.email.findMany({
      where: {
        lead: { teamId },
        status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY"] },
      },
      include: { lead: true },
    });

    for (const email of draftEmails) {
      if (!existingEmailIds.has(email.id)) {
        await ApprovalService.requestEntityApproval(
          "email",
          email.id,
          teamId,
          "email_draft_approval",
          {
            emailId: email.id,
            leadId: email.leadId,
            campaignId: email.campaignId,
            subject: email.subject,
            body: email.body,
            recipient: email.lead?.email,
          },
          userId
        ).catch((err) => {
            console.error("[Dashboard Summary] Self-healing ApprovalRequest backfill error:", err?.message || err);
        });
      }
    }

    // Query real per-team workspace aggregate statistics
    const [
      totalLeads,
      activePipelineLeads,
      meetingsBookedCount,
      draftsCount,
      pendingApprovalCount,
      sentEmailsCount,
      signalsCount,
      recentActivities,
      totalEmailCount,
    ] = await Promise.all([
      // Total leads imported
      prisma.lead.count({ where: { teamId } }),

      // Active pipeline: leads not in terminal statuses
      prisma.lead.count({
        where: {
          teamId,
          status: { notIn: ["REJECTED", "OPT_OUT", "BOUNCED", "UNSUBSCRIBED"] },
        },
      }),

      // Meetings secured: meetings booked or leads with status MEETING_BOOKED
      prisma.meeting.count({ where: { teamId } }),

      // Drafts queued: drafts awaiting approval / send
      prisma.email.count({
        where: {
          lead: { teamId },
          status: { in: ["draft", "DRAFT", "draft_ready", "DRAFT_READY", "queued", "QUEUED"] },
        },
      }),

      // Follow-ups / pending approval requests
      prisma.approvalRequest.count({
        where: {
          teamId,
          status: "PENDING",
        },
      }),

      // Emails successfully sent
      prisma.email.count({
        where: {
          lead: { teamId },
          status: "sent",
        },
      }),

      // Signal capture: count of email events (opens, clicks, replies)
      prisma.emailEvent.count({
        where: {
          teamId,
          type: { in: ["OPENED", "CLICKED", "REPLY_RECEIVED"] },
        },
      }),

      // Live recent activity log
      prisma.leadActivity.findMany({
        where: {
          lead: { teamId },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
        include: {
          lead: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      }),
      // Total email records ever generated for team
      prisma.email.count({
        where: { lead: { teamId } },
      }),
    ]);

    // Recent leads for the Tier-2 leads table (row click opens the drill-down slide-over)
    const recentLeadsRaw = await prisma.lead.findMany({
      where: { teamId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        fullName: true,
        email: true,
        company: true,
        status: true,
        updatedAt: true,
      },
    });
    const recentLeads = recentLeadsRaw.map((lead) => ({
      id: lead.id,
      name: lead.fullName || lead.email || "Unknown",
      company: lead.company || "—",
      status: lead.status,
      lastActivityAt: lead.updatedAt.toISOString(),
    }));

    // Pipeline trend: cumulative leads created per day, last 30 days
    const trendStart = new Date();
    trendStart.setDate(trendStart.getDate() - 29);
    trendStart.setHours(0, 0, 0, 0);
    const [leadsBeforeWindow, leadsInWindow] = await Promise.all([
      prisma.lead.count({ where: { teamId, createdAt: { lt: trendStart } } }),
      prisma.lead.findMany({
        where: { teamId, createdAt: { gte: trendStart } },
        select: { createdAt: true },
      }),
    ]);
    const dayBuckets = new Array(30).fill(0);
    for (const { createdAt } of leadsInWindow) {
      const dayIndex = Math.floor((createdAt.getTime() - trendStart.getTime()) / 86400000);
      if (dayIndex >= 0 && dayIndex < 30) dayBuckets[dayIndex]++;
    }
    let running = leadsBeforeWindow;
    const pipelineTrend = dayBuckets.map((count) => {
      running += count;
      return running;
    });

    // Map recentActivity list
    let recentActivity = recentActivities.map((act) => {
      let type: 'meeting_booked' | 'draft_generated' | 'follow_up_flagged' | 'campaign_activated' = 'draft_generated';
      if (act.type.toLowerCase().includes('meeting') || act.type.toLowerCase().includes('booked')) {
        type = 'meeting_booked';
      } else if (act.type.toLowerCase().includes('reply') || act.type.toLowerCase().includes('flagged')) {
        type = 'follow_up_flagged';
      } else if (act.type.toLowerCase().includes('campaign')) {
        type = 'campaign_activated';
      }

      const name = act.lead?.fullName || act.lead?.email || "Prospect";
      return {
        id: act.id,
        type,
        description: `${act.title} — ${name}`,
        timestamp: act.createdAt.toISOString(),
      };
    });

    // Calculate setup completion percent
    const [mailboxesCount, campaignsCount, policy] = await Promise.all([
      prisma.connectedMailbox.count({ where: { teamId, status: "CONNECTED" } }),
      prisma.campaign.count({ where: { teamId } }),
      prisma.organizationPolicy.findUnique({ where: { organizationId: teamId } }),
    ]);

    let setupPercent = 0;
    if (mailboxesCount > 0) setupPercent += 25;
    if (totalLeads > 0) setupPercent += 25;
    if (campaignsCount > 0) setupPercent += 25;
    if (policy) setupPercent += 25;

    // Signal capture open rate calculation or default 0%
    const openRatePct = sentEmailsCount > 0 ? Math.round((signalsCount / sentEmailsCount) * 100) : 0;

    return NextResponse.json({
      kpis: {
        meetingsBooked: meetingsBookedCount,
        meetingsDelta: 0,
        activeLeads: activePipelineLeads,
        draftsReady: draftsCount,
        draftsPendingSend: pendingApprovalCount,
        openRatePct,
        openRateDelta: 0,
      },
      workflow: {
        leadsImported: totalLeads > 0,
        leadsCount: totalLeads,
        draftsGenerated: totalEmailCount > 0,
        draftsCount: totalEmailCount,
        followUpsReviewed: pendingApprovalCount === 0 && totalEmailCount > 0,
        followUpsCount: pendingApprovalCount,
        pendingSendCount: draftsCount,
      },
      recentActivity,
      recentLeads,
      pipelineTrend,
      setupPercent,
    });

  } catch (error) {
    console.error("Dashboard Summary API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
