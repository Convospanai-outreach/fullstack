import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

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

    console.log(
        `🎯 Executing campaign: ${campaign.name} with ${campaign.leadList.length} leads`
    );

    // Enqueue enrichment jobs for each lead
    const enrichmentJobs = [];
    for (const lead of campaign.leadList) {
        const job = await JobQueue.enqueue(
            "lead_enrichment",
            {
                leadId: lead.id,
                campaignId: campaign.id,
                userId: effectiveUserId,
                teamId: campaign.teamId, // Add this
            },
            { priority: 1, teamId: campaign.teamId as string } // Pass in options too
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
            .catch(console.error);
    }

    return {
        campaignId,
        leadsProcessed: campaign.leadList.length,
        enrichmentJobsCreated: enrichmentJobs.length,
        jobIds: enrichmentJobs,
    };
}
