import { NextResponse } from 'next/server';
import { getCurrentContext } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

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
    const teamId = await resolveTeamId();
    
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
        setupPercent: 0,
      });
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
      recentActivities
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
    ]);

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

    if (recentActivity.length === 0) {
      recentActivity = [
        {
          id: 'ready-1',
          type: 'campaign_activated',
          description: 'Outreach Pipeline Active — Ready for imports and draft generation',
          timestamp: new Date().toISOString(),
        },
      ];
    }

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
        draftsGenerated: draftsCount > 0,
        draftsCount,
        followUpsReviewed: pendingApprovalCount === 0 && draftsCount > 0,
        followUpsCount: pendingApprovalCount,
        pendingSendCount: draftsCount,
      },
      recentActivity,
      setupPercent,
    });

  } catch (error) {
    console.error("Dashboard Summary API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
