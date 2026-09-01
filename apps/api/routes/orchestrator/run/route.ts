import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { enforcePolicy } from "@/lib/governance/guard";
import { audit } from "@/lib/governance/audit";
import { checkLimits } from "@/lib/governance/limits";

export async function POST(req: NextRequest) {
  const { userId } = await getCurrentContextFromRequest(req);
  if (!userId) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const { campaignId } = body;

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId is required" },
      { status: 400 }
    );
  }

  const { startDate } = body;
  const processAt = startDate ? new Date(startDate) : null;

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return new NextResponse("Campaign not found", { status: 404 });
  const teamId = campaign.teamId;

  if (!teamId) return new NextResponse("Team ID not found for campaign", { status: 400 });

  // GOVERNANCE CHECKS
  try {
    await checkLimits(teamId, "CAMPAIGN_RUN");
    await enforcePolicy({
      orgId: teamId,
      userId,
      action: "CAMPAIGN_RUN",
      payload: { campaignId, scheduled: !!startDate, approvalId: body.approvalId }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // If scheduled, update campaign status immediately for UI feedback. Scoped by teamId (in
  // addition to the membership check enforcePolicy just did above) and only runs after that
  // check passes - it previously ran unconditionally before any team-membership was verified,
  // letting any authenticated user reschedule any team's campaign by guessing its id.
  if (startDate) {
    await prisma.campaign.updateMany({
      where: { id: campaignId, teamId },
      data: {
        status: "scheduled",
        scheduledStart: processAt
      }
    });
  }

  const job = await JobQueue.enqueue("campaign_execution", { campaignId, userId }, { processAt });

  // Mandatory Audit Logging
  await audit({
    actorId: userId,
    orgId: teamId,
    action: startDate ? "CAMPAIGN_SCHEDULED" : "CAMPAIGN_RUN",
    entity: "Campaign",
    entityId: campaignId,
    metadata: { scheduled: !!startDate, jobId: job.id },
  });

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    message: startDate ? "Campaign scheduled" : "Campaign execution job enqueued",
  });
}
