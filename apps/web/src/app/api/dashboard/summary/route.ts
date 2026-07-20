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

    // Get actual counts from DB
    const [
      leadsCount,
      meetingsBooked,
      draftsReady,
      draftsPendingSend,
      followUpsCount,
      recentActivities
    ] = await Promise.all([
      prisma.lead.count({ where: { teamId } }),
      prisma.meeting.count({ where: { teamId } }),
      prisma.generation.count({
        where: {
          lead: { teamId },
          status: "PENDING"
        }
      }),
      // Check emails that are drafts/pending
      prisma.email.count({
        where: {
          lead: { teamId },
          status: "draft"
        }
      }),
      prisma.emailEvent.count({
        where: {
          teamId,
          type: { in: ["REPLIED", "REPLY_RECEIVED"] }
        }
      }),
      prisma.leadActivity.findMany({
        where: {
          lead: { teamId }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10,
        include: {
          lead: {
            select: {
              fullName: true,
              email: true
            }
          }
        }
      })
    ]);

    // Map recentActivities to recentActivity list
    let recentActivity = recentActivities.map((act) => {
      let type: 'meeting_booked' | 'draft_generated' | 'follow_up_flagged' | 'campaign_activated' = 'draft_generated';
      if (act.type.toLowerCase().includes('meeting') || act.type.toLowerCase().includes('booked')) {
        type = 'meeting_booked';
      } else if (act.type.toLowerCase().includes('reply') || act.type.toLowerCase().includes('flagged')) {
        type = 'follow_up_flagged';
      } else if (act.type.toLowerCase().includes('campaign')) {
        type = 'campaign_activated';
      }

      const name = act.lead?.fullName || act.lead?.email || "Unknown Prospect";
      return {
        id: act.id,
        type,
        description: `${act.title} — ${name}`,
        timestamp: act.createdAt.toISOString()
      };
    });

    if (recentActivity.length === 0) {
      recentActivity = [
        { id: 'mock-1', type: 'campaign_activated', description: 'System Ready — Waiting for lead activity', timestamp: new Date().toISOString() }
      ];
    }

    const activeLeads = leadsCount;
    const draftsCount = draftsReady;
    const pendingSendCount = draftsPendingSend;

    // Calculate setup completion percent
    const [mailboxesCount, campaignsCount, policy] = await Promise.all([
      prisma.connectedMailbox.count({ where: { teamId, status: "CONNECTED" } }),
      prisma.campaign.count({ where: { teamId } }),
      prisma.organizationPolicy.findUnique({ where: { organizationId: teamId } })
    ]);

    let setupPercent = 0;
    if (mailboxesCount > 0) setupPercent += 25;
    if (leadsCount > 0) setupPercent += 25;
    if (campaignsCount > 0) setupPercent += 25;
    if (policy) setupPercent += 25;

    return NextResponse.json({
      kpis: {
        meetingsBooked,
        meetingsDelta: 0,
        activeLeads,
        draftsReady,
        draftsPendingSend,
        openRatePct: 0,
        openRateDelta: 0,
      },
      workflow: {
        leadsImported: leadsCount > 0,
        leadsCount,
        draftsGenerated: draftsCount > 0,
        draftsCount,
        followUpsReviewed: followUpsCount > 0,
        followUpsCount,
        pendingSendCount,
      },
      recentActivity,
      setupPercent,
    });

  } catch (error) {
    console.error("Dashboard Summary API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
