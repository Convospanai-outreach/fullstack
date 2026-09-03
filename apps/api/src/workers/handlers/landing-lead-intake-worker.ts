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
        include: { campaign: { select: { linkedCampaignId: true } } },
    });

    if (!landingLead) {
        logger.warn(`[LandingLeadIntake] LandingLead ${landingLeadId} not found for team ${teamId} — skipping`);
        return { created: false, reason: "landing_lead_not_found" };
    }

    const email = landingLead.email?.trim().toLowerCase() || undefined;
    const campaignId = landingLead.campaign.linkedCampaignId || undefined;

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

            await scoreNewLead(existing.id);
            await pushToMautic(existing.id, teamId);
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

    await scoreNewLead(createdLead.id);
    await pushToMautic(createdLead.id, teamId);
    return { created: true, leadId: createdLead.id };
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
