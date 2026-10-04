import { prisma } from "@/lib/db";
import { scraperService } from "@/modules/scraper-bridge";
import { hunterService } from "@/modules/hunter-email-finder";
import { JobQueue, JobPayload } from "@/lib/queue";
import { deductCredits, refundCredits } from "@/lib/credits";
import { logger, logWorker } from "@/lib/logger";
import { recordLeadDataSources } from "@/lib/crm/leadDataSource";
import { linkedInHandle } from "@/lib/crm/linkedin";
import { tryNormalizeDomain } from "@/lib/crm/domain";

// Free-mail providers: an address here says nothing about the lead's company.
const WEBMAIL_DOMAINS = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com", "hotmail.com", "live.com",
    "msn.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "zoho.com", "gmx.com",
    "rediffmail.com", "yandex.com", "mail.com",
]);
// The name the extension capture uses when the profile's name wasn't readable.
const PLACEHOLDER_NAME = "Unknown LinkedIn Lead";

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

        // Scrape LinkedIn profile if we have a LinkedIn URL. Skipped for leads the Chrome
        // extension captured: the profile was read in the user's own browser already, and
        // a server-side browser launch per capture is heavy on the worker.
        const enriched = (lead.enrichedData && typeof lead.enrichedData === "object" ? lead.enrichedData : {}) as Record<string, any>;
        const capturedByExtension = lead.source === "chrome_extension" || Boolean(enriched["extensionCapture"]) || enriched["source"] === "linkedin_extension";
        if (lead.linkedIn && !capturedByExtension) {
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

        // Find email if we do not have one. Hunter looks the person up by LinkedIn handle when
        // there is one (no name needed), else by the lead's own domain, else by company name -
        // Hunter resolves the company's domain itself, so nothing is guessed here.
        let hunterCompanyPromotion: string | undefined;
        let hunterDomainPromotion: string | undefined;
        const handle = linkedInHandle(lead.linkedIn);
        const knownName = lead.fullName && lead.fullName !== PLACEHOLDER_NAME ? lead.fullName : "";
        const leadDomain = tryNormalizeDomain(lead.domain);
        const ownDomain = leadDomain && !WEBMAIL_DOMAINS.has(leadDomain) ? leadDomain : undefined;
        if (!lead.email && (handle || (knownName && (ownDomain || lead.company)))) {
            try {
                const nameParts = knownName.split(" ");
                const firstName = nameParts[0];
                const lastName = nameParts.slice(1).join(" ");

                const result = await hunterService.findAndStoreEmail({
                    firstName: firstName || "",
                    lastName: lastName || "",
                    ...(handle ? { linkedinHandle: handle } : {}),
                    ...(ownDomain ? { domain: ownDomain } : lead.company ? { company: lead.company } : {}),
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
                if (result.email || result.company || result.domain) {
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
                                    domain: result.domain ?? null,
                                    // Kept here only - not copied to Lead.phone.
                                    phoneNumber: result.phoneNumber ?? null,
                                    receivedAt: new Date().toISOString(),
                                },
                            },
                        },
                    });
                    if (result.company && !current?.company) {
                        hunterCompanyPromotion = result.company;
                    }
                    // The company domain Hunter resolved (or the found address's domain) fills
                    // an empty Lead.domain, so the org chart can group the lead with its account.
                    const foundDomain = tryNormalizeDomain(result.domain) ?? tryNormalizeDomain(result.email?.split("@")[1]);
                    if (!lead.domain && foundDomain && !WEBMAIL_DOMAINS.has(foundDomain)) {
                        hunterDomainPromotion = foundDomain;
                    }
                }
            } catch (error) {
                logger.warn("Failed to find email with Hunter.io:", { leadId, error: error instanceof Error ? error.message : error });
            }
        }

        // Crystal Knows personality enrichment - best-effort, silently skipped
        // if the team hasn't configured a Crystal API key (CrystalService
        // returns "not_configured" rather than throwing). A "pending" result
        // (job didn't finish within the bounded poll) is dropped here; a
        // later enrichment pass will simply find the now-completed profile
        // via the free GET /v4/profile lookup instead of re-submitting.
        if (teamId) {
            try {
                const { CrystalService } = await import("@/modules/crystal-knows/service/crystalService");
                const crystalResult = await CrystalService.findOrCreateProfile(
                    teamId,
                    {
                        full_name: knownName || undefined,
                        email: enrichmentData.email || lead.email || undefined,
                        linkedin_url: lead.linkedIn || undefined,
                        job_title: lead.jobTitle || undefined,
                        company_name: hunterCompanyPromotion || lead.company || undefined,
                    },
                    { recordId: `lead:${leadId}`, maxWaitMs: 20_000 }
                );

                if (crystalResult.state === "found") {
                    // Persist reusable guidance so drafts and the lead page never need a live Crystal call.
                    // Best-effort (returns null on failure) - enrichment still stores the profile without it.
                    const guidance = await CrystalService.generatePersonalityGuidance(teamId, {
                        id: crystalResult.profile.id,
                        objective: "communicate effectively with this person",
                    });
                    const current = await prisma.lead.findUnique({ where: { id: leadId }, select: { enrichedData: true } });
                    const currentEnrichedData = (current?.enrichedData as Record<string, any>) || {};
                    await prisma.lead.update({
                        where: { id: leadId },
                        data: {
                            enrichedData: {
                                ...currentEnrichedData,
                                crystalKnows: {
                                    profileId: crystalResult.profile.id,
                                    personalities: crystalResult.profile.personalities ?? null,
                                    guidance,
                                    receivedAt: new Date().toISOString(),
                                },
                            },
                        },
                    });
                    await recordLeadDataSources([
                        { leadId, field: "enrichedData.crystalKnows", source: "CRYSTAL_KNOWS", value: crystalResult.profile.id },
                    ]);
                }
            } catch (error) {
                logger.warn("Failed to enrich lead with Crystal Knows:", { leadId, error: error instanceof Error ? error.message : error });
            }
        }

        // Mark the lead enriched. The status moves to "enriched" only from NEW: a lead already
        // further along (LINKEDIN_CAPTURED, CONTACTED, REPLIED, WON...) keeps its status.
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                ...(!lead.status || lead.status === "NEW" ? { status: "enriched" } : {}),
                isEnriched: true,
                ...(enrichmentData.email ? { email: enrichmentData.email } : {}),
                ...(hunterCompanyPromotion ? { company: hunterCompanyPromotion } : {}),
                ...(hunterDomainPromotion ? { domain: hunterDomainPromotion } : {}),
            },
        });

        // A sequence chosen in the Chrome extension before the lead had an email starts now.
        if (enrichmentData.email) {
            try {
                const { enrollPendingSequence } = await import("@/services/extensionLeadCaptureService");
                await enrollPendingSequence(leadId);
            } catch (error) {
                logger.warn("[Worker] Couldn't start the sequence chosen in the extension", { leadId, error: error instanceof Error ? error.message : error });
            }
        }

        const provenance: Parameters<typeof recordLeadDataSources>[0] = [];
        if (enrichmentData.email) provenance.push({ leadId, field: "email", source: "HUNTER", value: enrichmentData.email });
        if (hunterCompanyPromotion) provenance.push({ leadId, field: "company", source: "HUNTER", value: hunterCompanyPromotion });
        if (hunterDomainPromotion) provenance.push({ leadId, field: "domain", source: "HUNTER", value: hunterDomainPromotion });
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
