import { prisma } from "@/lib/db";
import { scraperService } from "@/modules/scraper-bridge";
import { hunterService } from "@/modules/hunter-email-finder";
import { JobQueue, JobPayload } from "@/lib/queue";
import { deductCredits, refundCredits } from "@/lib/credits";
import { logger, logWorker } from "@/lib/logger";
import { recordLeadDataSources } from "@/lib/crm/leadDataSource";

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

        // payload.teamId is caller-supplied (from the enqueuing route), not
        // derived from the lead itself - re-verify it matches the lead's own
        // team before mutating it or dispatching a webhook about it, in case
        // some future/direct enqueue path skips the route-level pre-check.
        if (teamId && lead.teamId && lead.teamId !== teamId) {
            throw new Error(`Lead ${leadId} does not belong to team ${teamId}`);
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
        let hunterCompanyPromotion: string | undefined;
        if (!lead.email && lead.fullName) {
            try {
                // Prefer the lead's own canonical domain when set (from CSV/manual data) -
                // only fall back to guessing when no real domain is on file. The guess is
                // transient (used for this Hunter call only) and is never persisted to
                // Lead.domain, since Hunter's response carries no domain to validate it
                // against.
                let domain: string | null = lead.domain || null;

                if (!domain && lead.linkedIn) {
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

                    // Hunter's response also carries score/name/position/company/sources -
                    // previously discarded entirely. Record it under a provider-namespaced
                    // key (matching Netjana's enrichedData.netjana convention) even when not
                    // promoted to a top-level Lead field, and promote company only when the
                    // lead doesn't already have one (never overwrite an existing value).
                    if (result.email || result.company) {
                        const current = await prisma.lead.findUnique({ where: { id: leadId }, select: { enrichedData: true, company: true } });
                        const currentEnrichedData = (current?.enrichedData as Record<string, any>) || {};
                        await prisma.lead.update({
                            where: { id: leadId },
                            data: {
                                enrichedData: {
                                    ...currentEnrichedData,
                                    hunter: {
                                        score: result.score,
                                        firstName: result.firstName,
                                        lastName: result.lastName,
                                        position: result.position,
                                        company: result.company,
                                        sources: result.sources,
                                        receivedAt: new Date().toISOString(),
                                    },
                                },
                            },
                        });
                        if (result.company && !current?.company) {
                            hunterCompanyPromotion = result.company;
                        }
                    }
                }
            } catch (error) {
                logger.warn("Failed to find email with Hunter.io:", { leadId, error: error instanceof Error ? error.message : error });
            }
        }

        // Update lead status to enriched
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                status: "enriched",
                isEnriched: true,
                ...(enrichmentData.email ? { email: enrichmentData.email } : {}),
                ...(hunterCompanyPromotion ? { company: hunterCompanyPromotion } : {}),
            },
        });

        const provenance: Parameters<typeof recordLeadDataSources>[0] = [];
        if (enrichmentData.email) provenance.push({ leadId, field: "email", source: "HUNTER", value: enrichmentData.email });
        if (hunterCompanyPromotion) provenance.push({ leadId, field: "company", source: "HUNTER", value: hunterCompanyPromotion });
        await recordLeadDataSources(provenance);

        // If part of a campaign, enqueue email job (REALTIME mode) or fold
        // into the campaign's batch email-draft generation (BATCH mode).
        if (campaignId && (lead.email || enrichmentData.email)) {
            const campaign = await prisma.campaign.findUnique({
                where: { id: campaignId },
                select: { draftGenerationMode: true },
            });

            if (campaign?.draftGenerationMode === "BATCH") {
                // Fan-in: decrement the counter seeded by campaign-worker.ts at
                // campaign start. Whichever enrichment job observes it reach 0
                // is the one that submits the campaign-wide batch - the
                // idempotency key guards the race where two jobs both see 0.
                const updated = await prisma.campaign.update({
                    where: { id: campaignId },
                    data: { enrichmentPending: { decrement: 1 } },
                    select: { enrichmentPending: true, teamId: true },
                });
                if (updated.enrichmentPending <= 0 && updated.teamId) {
                    await JobQueue.enqueue(
                        "EMAIL_DRAFT_BATCH_SUBMIT",
                        { campaignId, teamId: updated.teamId },
                        { teamId: updated.teamId, idempotencyKey: `batch_submit_${campaignId}` }
                    );
                }
            } else {
                await JobQueue.enqueue("email_sending", {
                    leadId,
                    campaignId,
                    enrichmentData,
                    userId,
                    teamId,
                });
            }
        }

        // Trigger webhook
        if (teamId) {
            import("@/modules/webhooks/service/webhookService")
                .then(({ webhookService }) => webhookService.dispatch(teamId, "lead.enriched", enrichmentData))
                .catch(err => logger.error("[Worker] Failed to dispatch enrichment webhook", { error: err.message }));
        }

        // Auto-score after enrichment — this drives COLD→WARM→HOT transitions
        try {
            const { leadScoringService } = await import("@/modules/scoring");
            await leadScoringService.scoreAndPersist(leadId);
        } catch (scoreErr) {
            // Non-fatal: enrichment succeeded even if scoring fails
            logger.warn(`[Worker] Post-enrichment scoring failed for lead ${leadId}:`, scoreErr);
        }

        return enrichmentData;

    } catch (err) {
        if (teamId && charged) {
            await refundCredits(teamId, ENRICHMENT_COST, `Refund: enrichment failed for ${leadId}`);
        }
        throw err;
    }
}
