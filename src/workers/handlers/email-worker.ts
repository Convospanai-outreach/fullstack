import { prisma } from "@/lib/db";
import { emailService } from "@/modules/email-campaigner";
import { aiService } from "@/modules/ai-content/service/aiService";

/**
 * Email sending worker
 * Sends personalized email to a lead
 */
export async function handleEmailSend(payload: {
    leadId: string;
    campaignId: string;
    enrichmentData?: any;
}) {
    const { leadId, campaignId, enrichmentData } = payload;

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
        throw new Error(`Lead ${leadId} has no email address`);
    }

    console.log(`📧 Generating AI email for: ${lead.email}`);

    // Generate personalized email content using the NEW AI Sales Agent logic
    const emailContent = await aiService.generateEmailDraft(
        lead,
        null, // Could pass campaign.icpId if related
        campaign.teamId || undefined
    );

    // Send email via Email Service
    try {
        const result = await emailService.sendEmail(
            lead.email,
            emailContent.subject,
            emailContent.body,
            { leadId, campaignId }
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

        return {
            leadId,
            email: lead.email,
            sent: true,
            result,
        };
    } catch (error) {
        console.error("Failed to send email:", error);
        throw error;
    }
}
