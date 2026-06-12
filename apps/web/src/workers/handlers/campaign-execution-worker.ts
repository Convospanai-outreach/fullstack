import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { JobQueue, JobPayload } from "@/lib/queue";

export async function handleCampaignExecution(payload: JobPayload) {
  const { campaignId, teamId, userId } = payload;

  if (!campaignId) {
    throw new Error("campaign_execution: campaignId is required");
  }

  // 1. Load the campaign
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId }
  });

  if (!campaign) {
    throw new Error(`Campaign ${campaignId} not found`);
  }

  // 2. Verify campaign status
  if (campaign.status !== "active") {
    throw new Error(`Campaign ${campaignId} is not active (status: ${campaign.status})`);
  }

  // 3. Fetch all leads associated with the campaign
  const leads = await prisma.lead.findMany({
    where: { campaignId },
    take: 50
  });

  // 4. Enqueue email_sending jobs
  let enqueued = 0;
  for (const lead of leads) {
    await JobQueue.enqueue("email_sending", { leadId: lead.id, campaignId, teamId: teamId || campaign.teamId || undefined, userId });
    enqueued++;
  }

  // 5. Increment campaign.completedCount
  if (enqueued > 0) {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: { completedCount: { increment: enqueued } }
    });
  }

  // 6. Log result
  logger.info("[campaign_execution] Enqueued child jobs", { campaignId, enqueued });

  // 7. Return count
  return { enqueued };
}
