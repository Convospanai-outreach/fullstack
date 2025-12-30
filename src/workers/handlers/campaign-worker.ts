import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";
import { logger, logWorker } from "@/lib/logger";

/**
 * Campaign execution worker
 * Orchestrates the entire campaign workflow for all leads
 */
export async function executeCampaign(campaignId: string, userId?: string) {
    // Fetch campaign with leads
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { leadList: true },
    });

    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    // Fallback: If userId not passed (e.g. older jobs), use campaign owner
    const effectiveUserId = userId || campaign.ownerId;

    logWorker(campaignId, "CAMPAIGN_EXECUTION_START", {
        name: campaign.name,
        leadCount: campaign.leadList.length,
        teamId: campaign.teamId
    });

    // Enqueue enrichment jobs for each lead
    const enrichmentJobs = [];
    for (const lead of campaign.leadList) {
        const job = await JobQueue.enqueue(
            "lead_enrichment",
            {
                leadId: lead.id,
                campaignId: campaign.id,
                userId: effectiveUserId ?? undefined,
                teamId: campaign.teamId ?? undefined,
            },
            {
                priority: 1,
                teamId: (campaign.teamId as string) ?? undefined,
                idempotencyKey: `enrich_${campaign.id}_${lead.id}` // Idempotency Key
            }
        );
        enrichmentJobs.push(job.id);
    }

    // Update campaign status to active
    await prisma.campaign.update({
        where: { id: campaignId },
        data: { status: "active" },
    });

    // Trigger Webhook
    if (campaign.teamId) {
        import("@/modules/webhooks/service/webhookService")
            .then(({ webhookService }) => webhookService.dispatch(campaign.teamId as string, "campaign.started", { campaignId, userId: effectiveUserId }))
            .catch(err => logger.error(`[Worker] Failed to dispatch campaign.started webhook`, { error: err.message }));
    }

    return {
        campaignId,
        leadsProcessed: campaign.leadList.length,
        enrichmentJobsCreated: enrichmentJobs.length,
        jobIds: enrichmentJobs,
    };
}
