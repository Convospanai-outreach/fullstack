import { prisma } from "@/lib/db";
import { emailService } from "@/modules/email-campaigner";
import { aiService } from "@/lib/aiService";
import { logger, logWorker } from "@/lib/logger";
import { JobPayload } from "@/lib/queue";

/**
 * Email sending worker
 * Sends personalized email to a lead
 */
export async function handleEmailSend(payload: JobPayload) {
    const { leadId, campaignId, teamId } = payload;

    if (!leadId || !campaignId) {
        throw new Error("Missing leadId or campaignId in email job payload");
    }

    // Fetch lead and campaign
    const [lead, campaign] = await Promise.all([
        prisma.lead.findUnique({ where: { id: leadId } }),
        prisma.campaign.findUnique({ where: { id: campaignId } }),
    ]);

    if (!lead) {
        throw new Error(`Lead ${leadId} not found`);
    }

    if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!lead.email) {
        logger.warn(`[Worker] Skipping email: Lead ${leadId} has no email address.`, { leadId, campaignId });
        return;
    }

    logWorker(leadId, "GENERATING_AI_EMAIL", { campaignId, teamId });

    // Generate personalized email content using the NEW AI Sales Agent logic
    const emailContent = await aiService.generateEmailDraft(
        lead,
        null, // Could pass campaign.icpId if related
        campaign.teamId || undefined
    );

    // Send email via Email Service
    try {
    const metadata: { leadId?: string; campaignId?: string; teamId?: string; userId?: string } = { leadId, campaignId };
    const resolvedTeamId = campaign.teamId || teamId;
    if (resolvedTeamId) metadata.teamId = resolvedTeamId;
    if (campaign.ownerId) metadata.userId = campaign.ownerId;

    const result = await emailService.sendEmail(
        lead.email,
        emailContent.subject,
        emailContent.body,
        metadata
    );

        // Update lead status
        await prisma.lead.update({
            where: { id: leadId },
            data: { status: "contacted" },
        });

        // Update campaign completed count
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { completedCount: { increment: 1 } },
        });

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
