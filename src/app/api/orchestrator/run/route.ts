import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { AuditService } from "@/modules/audit/auditService";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.email) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return new NextResponse("User not found", { status: 404 });

  const body = await req.json();
  const { campaignId } = body;

  if (!campaignId) {
    return NextResponse.json(
      { error: "campaignId is required" },
      { status: 400 }
    );
  }

  // Enqueue campaign execution job
  // Enqueue campaign execution job
  const { startDate } = body;
  const processAt = startDate ? new Date(startDate) : undefined;

  // If scheduled, update campaign status immediately for UI feedback
  if (startDate) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        status: "scheduled",
        scheduledStart: processAt
      }
    });
  }

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return new NextResponse("Campaign not found", { status: 404 });
  const teamId = campaign.teamId;

  const job = await JobQueue.enqueue("campaign_execution", { campaignId, userId: user.id }, { processAt });

  // Audit Log
  if (teamId) {
    await AuditService.log(teamId, user.id, "CAMPAIGN_STARTED", "Campaign", campaignId, { scheduled: !!startDate });
  }

  return NextResponse.json({
    ok: true,
    jobId: job.id,
    message: startDate ? "Campaign scheduled" : "Campaign execution job enqueued",
  });
}
