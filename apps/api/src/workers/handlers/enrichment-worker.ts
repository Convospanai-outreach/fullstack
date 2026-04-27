import { prisma } from "@/lib/db";
import { scraperService } from "@/modules/scraper-bridge";
import { hunterService } from "@/modules/hunter-email-finder";
import { JobQueue, JobPayload } from "@/lib/queue";
import { deductCredits, refundCredits } from "@/lib/credits";
import { logger, logWorker } from "@/lib/logger";

/**
 * Lead enrichment worker
 * Enriches a single lead with company data, LinkedIn profile, and email
 */
export async function handleLeadEnrichment(payload: JobPayload) {
    const { leadId, campaignId, userId, teamId } = payload;

    if (!leadId) {
        throw new Error("Lead identifier (leadId) is missing in payload");
    }

    // Billing enforcement
    const ENRICHMENT_COST = 1;
    let charged = false;

    try {
        if (teamId) {
            const success = await deductCredits(teamId, ENRICHMENT_COST, `Enrichment for Lead ${leadId}`, { leadId, campaignId });
            if (!success) {
                logger.warn(`[Worker] Blocked enrichment for ${leadId}: insufficient credits in team ${teamId}`, { teamId, leadId });
                throw new Error("Insufficient credits");
            }
            charged = true;
        } else if (userId) {
            logger.warn(`[Worker] No teamId provided for enrichment of lead ${leadId}.`, { userId, leadId });
        }

        // Fetch lead
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
        });

        if (!lead) {
            throw new Error(`Lead ${leadId} not found`);
        }

        logWorker(leadId, "ENRICHING", { fullName: lead.fullName, teamId });

        const enrichmentData: Record<string, any> = {
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
                logger.warn("Failed to scrape LinkedIn:", { leadId, error: error instanceof Error ? error.message : error });
            }
        }

        // Find email if we do not have one
        if (!lead.email && lead.fullName) {
            try {
                // Real domain extraction: derive from LinkedIn company path or fallback to company name
                let domain: string | null = null;

                if (lead.linkedIn) {
                    const urlObj = new URL(lead.linkedIn);
                    const pathParts = urlObj.pathname.split("/").filter(Boolean);
                    if (lead.linkedIn.includes("/company/")) {
                        domain = `${pathParts[pathParts.length - 1]}.com`;
                    }
                }

                if (!domain && lead.company) {
                    domain = `${lead.company.toLowerCase().replace(/\s+/g, "")}.com`;
                }

                if (domain && domain !== "gmail.com") {
                    const nameParts = lead.fullName.split(" ");
                    const firstName = nameParts[0];
                    const lastName = nameParts.slice(1).join(" ");

                    const result = await hunterService.findAndStoreEmail({
                        firstName: firstName || "",
                        lastName: lastName || "",
                        domain,
                        leadId,
                    });

                    if (result.email) {
                        enrichmentData.email = result.email;
                    }
                }
            } catch (error) {
                logger.warn("Failed to find email with Hunter.io:", { leadId, error: error instanceof Error ? error.message : error });
            }
        }

        // Update lead status
        await prisma.lead.update({
            where: { id: leadId },
            data: { status: "enriched" },
        });

        // If part of a campaign, enqueue email job
        if (campaignId && (lead.email || enrichmentData.email)) {
            await JobQueue.enqueue("email_sending", {
                leadId,
                campaignId,
                enrichmentData,
                userId,
                teamId,
            });
        }

        // Trigger webhook
        if (teamId) {
            import("@/modules/webhooks/service/webhookService")
                .then(({ webhookService }) => webhookService.dispatch(teamId, "lead.enriched", enrichmentData))
                .catch(err => logger.error("[Worker] Failed to dispatch enrichment webhook", { error: err.message }));
        }

        return enrichmentData;
    } catch (err) {
        if (teamId && charged) {
            await refundCredits(teamId, ENRICHMENT_COST, `Refund: enrichment failed for ${leadId}`);
        }
        throw err;
    }
}
