import { prisma } from "@/lib/db";
import { emailService } from "@/modules/email-campaigner";
import { aiService } from "@/lib/aiService";
import { logger, logWorker } from "@/lib/logger";
import { JobPayload } from "@/lib/queue";
import { advanceLeadAfterEmailSent } from "@/lib/crm/leadStageTransitions";

/**
 * Email sending worker
 * Sends personalized email to a lead
 */
export async function handleEmailSend(payload: JobPayload, jobId?: string) {
    const { leadId, campaignId, teamId } = payload;

    if (!leadId || !campaignId) {
        throw new Error("Missing leadId or campaignId in email job payload");
    }

    // Idempotency guard: if a prior attempt of this exact job already
    // recorded a sent Email (e.g. the provider send succeeded but a
    // post-send write below threw, causing a retry), skip re-sending
    // rather than emailing the lead a second time.
    if (jobId) {
        const alreadySent = await prisma.email.findFirst({ where: { idempotencyKey: jobId } });
        if (alreadySent) {
            logger.warn(`[Worker] Skipping duplicate send: email already recorded for job ${jobId}`, { leadId, campaignId });
            return { leadId, campaignId, sent: true, alreadySent: true };
        }
    }

    // Fetch lead and campaign
    const [lead, campaign] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId }, include: { icp: true } }),
    ]);

    if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
    }

    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    // payload.teamId is caller-supplied (from whoever enqueued this job -
    // including the generic POST /api/jobs endpoint, which accepts arbitrary
    // leadId/campaignId with no ownership check of its own) - re-verify the
    // lead and campaign actually belong to that team before emailing the
    // lead or billing/crediting the campaign's team, matching the
    // enrichment-worker.ts defense-in-depth pattern.
    if (teamId && lead.teamId && lead.teamId !== teamId) {
        throw new Error(`Lead ${leadId} does not belong to team ${teamId}`);
    }
    if (teamId && campaign.teamId && campaign.teamId !== teamId) {
        throw new Error(`Campaign ${campaignId} does not belong to team ${teamId}`);
    }

    if (!lead.email) {
        logger.warn(`[Worker] Skipping email: Lead ${leadId} has no email address.`, { leadId, campaignId });
        return;
    }

    // BATCH-mode campaigns generate drafts up front via the Anthropic Message
    // Batches API (apps/api/src/lib/ai/batchDraftService.ts) and attach the
    // result here instead of paying for a second live generation call.
    const precomputedDraft = (payload as any).precomputedDraft as { subject?: string; body?: string } | undefined;
    let emailContent: { subject: string; body: string };
    if (precomputedDraft?.subject && precomputedDraft?.body) {
        logWorker(leadId, "USING_PRECOMPUTED_AI_EMAIL", { campaignId, teamId });
        emailContent = { subject: precomputedDraft.subject, body: precomputedDraft.body };
    } else {
        logWorker(leadId, "GENERATING_AI_EMAIL", { campaignId, teamId });
        emailContent = await aiService.generateEmailDraft(
            lead,
            campaign.icp?.criteria ?? null,
            campaign.teamId || undefined
        );
    }

    // Send email via Email Service
    try {
    const metadata: { leadId?: string; campaignId?: string; teamId?: string; userId?: string; idempotencyKey?: string } = { leadId, campaignId };
    const resolvedTeamId = campaign.teamId || teamId;
    if (resolvedTeamId) metadata.teamId = resolvedTeamId;
    if (campaign.ownerId) metadata.userId = campaign.ownerId;
    if (jobId) metadata.idempotencyKey = jobId;

    const result = await emailService.sendEmail(
        lead.email,
        emailContent.subject,
        emailContent.body,
        metadata
    );

        // The send itself has already happened at this point - a failure in
        // any of the following bookkeeping writes must not throw (which would
        // fail the job and trigger a retry that re-sends the email). Each is
        // independently best-effort.
        try {
            // Advance lead status/pipelineState (CONTACTED / COLD->WARM), matching
            // the uppercase status values the dashboard funnel query counts on.
            await advanceLeadAfterEmailSent(prisma, { leadId, teamId: resolvedTeamId, campaignId });
        } catch (postSendError) {
            logger.error(`[Worker] Failed to advance lead stage after send`, { leadId, campaignId, postSendError });
        }

        try {
            // Update campaign completed count
            await prisma.campaign.update({
                where: { id: campaignId },
                data: { completedCount: { increment: 1 } },
            });
        } catch (postSendError) {
            logger.error(`[Worker] Failed to increment campaign completedCount after send`, { leadId, campaignId, postSendError });
        }

        try {
            // Log activity
            await prisma.activity.create({
                data: {
                    type: "email_sent",
                    meta: {
                        leadId,
                        campaignId,
                        email: lead.email,
                        subject: emailContent.subject,
                        providerId: result.providerId,
                    },
                },
            });
        } catch (postSendError) {
            logger.error(`[Worker] Failed to log activity after send`, { leadId, campaignId, postSendError });
        }

        logger.info(`[Worker] Successfully sent email to ${lead.email}`, { leadId, campaignId });

        return {
            leadId,
            email: lead.email,
            sent: true,
            result,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[Worker] Failed to send email to ${lead.email}`, { leadId, campaignId, error: errorMessage });
        throw error;
    }
}
