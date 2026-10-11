import { prisma } from "@/lib/db";
import { JobPayload } from "@/lib/queue";
import { logger } from "@/lib/logger";

/**
 * Promotes a public /p/:slug funnel-page form submission (LandingLead) into the
 * real Lead/Campaign pipeline. Dedupes by email within the team, mirroring the
 * same findFirst-then-update-or-create pattern csvIngestionService already uses.
 */
export async function handleLandingLeadIntake(payload: JobPayload) {
    const { landingLeadId, teamId } = payload;

    if (!landingLeadId) {
        throw new Error("Landing lead identifier (landingLeadId) is missing in payload");
    }
    if (!teamId) {
        throw new Error("teamId is missing in payload");
    }

    const landingLead = await prisma.landingLead.findFirst({
        where: { id: landingLeadId, teamId },
        include: {
            campaign: { select: { linkedCampaignId: true } },
            landingPage: { select: { slug: true, team: { select: { name: true } } } },
        },
    });

    if (!landingLead) {
        logger.warn(`[LandingLeadIntake] LandingLead ${landingLeadId} not found for team ${teamId} — skipping`);
        return { created: false, reason: "landing_lead_not_found" };
    }

    const email = landingLead.email?.trim().toLowerCase() || undefined;
    const campaignId = landingLead.campaign.linkedCampaignId || undefined;

    // Creator funnel: a sign-up through a keyword auto-reply link joins the lead that auto-reply
    // went to (socialLinkMerge.ts). Anything it can't merge safely takes the normal path below.
    if (landingLead.socialToken) {
        let mergedLeadId: string | null = null;
        try {
            const { mergeSignupIntoSocialLead } = await import("@/modules/creator-funnel/socialLinkMerge");
            mergedLeadId = await mergeSignupIntoSocialLead(landingLead, campaignId);
        } catch (error) {
            logger.warn(`[LandingLeadIntake] Social link merge failed for ${landingLeadId}: ${error instanceof Error ? error.message : error}`);
        }
        if (mergedLeadId) {
            await recordFirstTouch(teamId, mergedLeadId, landingLead.utmContent);
            await scoreNewLead(mergedLeadId);
            await pushToMautic(mergedLeadId, teamId);
            await advanceCreatorFunnel(mergedLeadId, teamId);
            await recordOptIn(landingLead, mergedLeadId);
            await joinPlanNurture(landingLead, mergedLeadId);
            return { created: false, leadId: mergedLeadId, merged: true };
        }
    }

    if (email) {
        const existing = await prisma.lead.findFirst({
            where: { email, teamId },
        });

        if (existing) {
            // Scoped by teamId here too, not just the pre-check above - same anti-pattern
            // already fixed under OPEN-99/109/110/118/120/121/122/123/127/128.
            const result = await prisma.lead.updateMany({
                where: { id: existing.id, teamId },
                data: {
                    campaignId: campaignId || existing.campaignId,
                    fullName: landingLead.name?.trim() || existing.fullName || undefined,
                    phone: landingLead.phone?.trim() || existing.phone || undefined,
                    company: landingLead.company?.trim() || existing.company || undefined,
                    jobTitle: landingLead.title?.trim() || existing.jobTitle || undefined,
                    source: existing.source || "landing_page",
                },
            });

            if (result.count === 0) {
                logger.warn(`[LandingLeadIntake] Lead ${existing.id} no longer belongs to team ${teamId} — skipping update`);
                return { created: false, reason: "lead_not_found" };
            }

            await recordFirstTouch(teamId, existing.id, landingLead.utmContent);
            await scoreNewLead(existing.id);
            await pushToMautic(existing.id, teamId);
            await advanceCreatorFunnel(existing.id, teamId);
            await recordOptIn(landingLead, existing.id);
            await joinPlanNurture(landingLead, existing.id);
            return { created: false, leadId: existing.id };
        }
    }

    const createdLead = await prisma.lead.create({
        data: {
            teamId,
            campaignId,
            email,
            fullName: landingLead.name?.trim() || undefined,
            phone: landingLead.phone?.trim() || undefined,
            company: landingLead.company?.trim() || undefined,
            jobTitle: landingLead.title?.trim() || undefined,
            source: "landing_page",
            status: "NEW",
        },
    });

    await recordFirstTouch(teamId, createdLead.id, landingLead.utmContent);
    await scoreNewLead(createdLead.id);
    await pushToMautic(createdLead.id, teamId);
    await advanceCreatorFunnel(createdLead.id, teamId);
    await recordOptIn(landingLead, createdLead.id);
    await joinPlanNurture(landingLead, createdLead.id);
    return { created: true, leadId: createdLead.id };
}

// What a sign-up that joined a social lead gets afterwards, for sign-ups that don't come through a
// LandingLead (the Mautic form webhook). Each step is best-effort, like the intake above.
export async function afterSocialSignup(teamId: string, leadId: string, utmContent: string | null) {
    await recordFirstTouch(teamId, leadId, utmContent);
    await scoreNewLead(leadId);
    await pushToMautic(leadId, teamId);
    await advanceCreatorFunnel(leadId, teamId);
}

// Creator funnel: a sign-up on a launch plan's lead-magnet page joins the plan's nurture emails
// when that plan's nurture is switched on (playbookSwitches.ts). Never fails the intake job.
async function joinPlanNurture(landingLead: { teamId: string; landingPageId: string }, leadId: string) {
    try {
        const { enrollPlanNurture } = await import("@/modules/creator-funnel/playbookSwitches");
        const skipped = await enrollPlanNurture(landingLead, leadId);
        if (skipped && skipped !== "no switched-on plan for this page") logger.info(`[LandingLeadIntake] Plan nurture skipped for lead ${leadId}: ${skipped}`);
    } catch (error) {
        logger.warn(`[LandingLeadIntake] Plan nurture enrollment failed for lead ${leadId}: ${error instanceof Error ? error.message : error}`);
    }
}

// Creator funnel: the page's WhatsApp opt-in, recorded as consent when the lead kept the phone
// number it was given for (whatsappOptIn.ts). Never fails the intake job; the lead is already saved.
async function recordOptIn(landingLead: Parameters<typeof import("@/modules/creator-funnel/whatsappOptIn").recordWhatsappOptIn>[0], leadId: string) {
    if (!landingLead.whatsappConsent) return;
    try {
        const { recordWhatsappOptIn } = await import("@/modules/creator-funnel/whatsappOptIn");
        if (!(await recordWhatsappOptIn(landingLead, leadId))) logger.info(`[LandingLeadIntake] WhatsApp opt-in for ${landingLead.id} not recorded on lead ${leadId} (no matching phone, or already recorded)`);
    } catch (error) {
        logger.warn(`[LandingLeadIntake] WhatsApp opt-in failed for lead ${leadId}: ${error instanceof Error ? error.message : error}`);
    }
}

// Creator funnel: when the page URL's utm_content names one of the team's posts and the lead has
// no first touch yet, that post brought them in (Content ROI). Never fails the intake job.
async function recordFirstTouch(teamId: string, leadId: string, utmContent: string | null) {
    if (!utmContent) return;
    try {
        const { setFirstTouchPost } = await import("@/modules/creator-funnel/contentRoi");
        await setFirstTouchPost(teamId, leadId, utmContent);
    } catch (error) {
        logger.warn(`[LandingLeadIntake] First-touch attribution failed for lead ${leadId}: ${error instanceof Error ? error.message : error}`);
    }
}

// Creator funnel (teams with the flag on): a landing-page opt-in moves the lead to MOFU.
// Never fails the intake job; the lead is already saved.
async function advanceCreatorFunnel(leadId: string, teamId: string) {
    try {
        const { isCreatorFunnelEnabled } = await import("@/modules/creator-funnel/featureGate");
        if (!(await isCreatorFunnelEnabled(teamId))) return;
        const { applyFunnelEvent } = await import("@/modules/creator-funnel/funnelStageService");
        await applyFunnelEvent(teamId, leadId, "landing_opt_in");
    } catch (error) {
        logger.warn(`[LandingLeadIntake] Creator funnel stage update failed for lead ${leadId}: ${error instanceof Error ? error.message : error}`);
    }
}

// Feeds Mautic's funnel view/segmentation for real landing-page captures. One-way
// (app -> Mautic) - see mauticService.ts's header for the send-ownership invariant.
// A no-op (not an error) whenever Mautic isn't configured for this environment.
async function pushToMautic(leadId: string, teamId: string) {
    try {
        const { mauticService } = await import("@/modules/mautic-integration/service/mauticService");
        const result = await mauticService.pushLead(leadId, teamId);
        if (result.status === "error") {
            logger.warn(`[LandingLeadIntake] Mautic push failed for lead ${leadId}: ${result.details}`);
        }
    } catch (error) {
        logger.warn(`[LandingLeadIntake] Mautic push threw for lead ${leadId}:`, error as any);
    }
}

async function scoreNewLead(leadId: string) {
    try {
        const { leadScoringService } = await import("@/modules/scoring");
        await leadScoringService.scoreAndPersist(leadId);
    } catch (error) {
        logger.warn(`[LandingLeadIntake] Post-intake scoring failed for lead ${leadId}:`, error as any);
    }
}
