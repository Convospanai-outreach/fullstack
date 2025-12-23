import { prisma } from "@/lib/db";
import { scraperService } from "@/modules/scraper-bridge";
import { hunterService } from "@/modules/hunter-email-finder";
import { JobQueue } from "@/lib/queue";
import { deductCredits } from "@/lib/credits";

/**
 * Lead enrichment worker
 * Enriches a single lead with company data, LinkedIn profile, and email
 */
export async function handleLeadEnrichment(payload: {
    leadId: string;
    campaignId?: string;
    userId?: string;
    teamId?: string; // Add this
}) {
    const { leadId, campaignId, userId, teamId } = payload;

    // Billing Enforcement
    const ENRICHMENT_COST = 1; // Define cost per enrichment
    if (teamId) {
        const success = await deductCredits(teamId, ENRICHMENT_COST, `Enrichment for Lead ${leadId}`, { leadId, campaignId });
        if (!success) {
            console.warn(`⛔ Blocked enrichment for ${leadId}: Insufficient credits in team ${teamId}`);
            throw new Error("Insufficient credits");
        }
    } else if (userId) {
        // Fallback for older jobs or single user actions
        // Ideally we should find the team for this user
        console.warn(`⚠️ No teamId provided for enrichment of lead ${leadId}. Attempting to skip or find team...`);
    }

    // Fetch lead
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
    });

    if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
    }

    console.log(`🔍 Enriching lead: ${lead.fullName || lead.email || leadId}`);

    const enrichmentData: any = {
        leadId,
        enrichedAt: new Date().toISOString(),
    };

    // Scrape LinkedIn profile if we have a LinkedIn URL
    if (lead.linkedIn) {
        try {
            const result = await scraperService.scrape({
                target: "linkedin",
                url: lead.linkedIn,
            });

            if (result.success) {
                enrichmentData.linkedInProfile = result.data;
            }
        } catch (error) {
            console.warn("Failed to scrape LinkedIn:", error);
        }
    }

    // Find email if we don't have one
    if (!lead.email && lead.fullName) {
        try {
            // We need a domain to find email. 
            // If we scraped LinkedIn, we might have company info, but for now let's assume we need a domain.
            // This is a simplification. In a real app, we'd extract domain from LinkedIn company or website.
            const domain = "gmail.com"; // Placeholder or extract from lead data if available

            // Only try if we have a real domain (not generic)
            if (domain && domain !== "gmail.com") {
                const nameParts = lead.fullName.split(" ");
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(" ");

                const result = await hunterService.findAndStoreEmail({
                    firstName,
                    lastName,
                    domain,
                    leadId,
                });

                if (result.email) {
                    enrichmentData.email = result.email;
                }
            }
        } catch (error) {
            console.warn("Failed to find email:", error);
        }
    }

    // Update lead status
    await prisma.lead.update({
        where: { id: leadId },
        data: { status: "enriched" },
    });

    // If part of a campaign, enqueue email job
    if (campaignId && (lead.email || enrichmentData.email)) {
        await JobQueue.enqueue("email_sending", { // Renamed from email_send to match types
            leadId,
            campaignId,
            enrichmentData,
            userId, // Propagate for billing checks in email worker if needed
        });
    }

    // Trigger Webhook
    if (teamId) {
        import("@/modules/webhooks/service/webhookService")
            .then(({ webhookService }) => webhookService.dispatch(teamId, "lead.enriched", enrichmentData))
            .catch(console.error);
    }

    return enrichmentData;
}
