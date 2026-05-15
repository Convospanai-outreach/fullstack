/**
 * emailService.ts (email-campaigner module)
 * Real SMTP-powered email sending for campaign outreach.
 * Replaces the previous SendPulse mock stub.
 */
import { prisma } from "@/lib/db";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { getSmtpConfig } from "./smtpConfigService";
import { GmailMailboxService } from "@/lib/gmailMailboxService";
import { isSuppressed, logEmailActivity } from "@/lib/emailTracking";

export type EmailSendResult = {
    success: boolean;
    providerId?: string;
    error?: string;
};

class EmailService {
    /**
     * Send a campaign email using the team's stored SMTP credentials.
     * Records the email in the Email table on success.
     */
    async sendEmail(
        to: string,
        subject: string,
        body: string,
        metadata?: {
            leadId?: string;
            campaignId?: string;
            teamId?: string;
            fromName?: string;
            fromEmail?: string;
        }
    ): Promise<EmailSendResult> {
        const teamId = metadata?.teamId;
        if (teamId && await isSuppressed(teamId, to)) {
            return { success: false, error: "Recipient is suppressed for this team." };
        }

        if (teamId) {
            const gmailResult = await GmailMailboxService.sendCampaignEmail({
                teamId,
                to,
                subject,
                html: body,
                leadId: metadata?.leadId,
                campaignId: metadata?.campaignId,
                fromName: metadata?.fromName,
                fromEmail: metadata?.fromEmail,
            });
            if (gmailResult) {
                return gmailResult.success
                    ? { success: true, providerId: gmailResult.providerId }
                    : { success: false, error: gmailResult.error };
            }
        }

        // Lookup SMTP config
        let config = null;
        try {
            config = teamId ? await getSmtpConfig(teamId) : null;
        } catch (error: any) {
            const errMsg = error?.message || "Failed to load SMTP configuration.";
            console.error(`[EmailService] ${errMsg}`);
            return { success: false, error: errMsg };
        }
        if (!config) {
            const errMsg = teamId
                ? `No SMTP config found for team ${teamId}. Configure email in Setup → Step 3.`
                : "No teamId provided for email send.";
            console.error(`[EmailService] ${errMsg}`);
            return { success: false, error: errMsg };
        }

        const result = await sendViaSMTP(config, { to, subject, html: body });

        if (!result.success) {
            if (teamId) {
                await logEmailActivity({
                    teamId,
                    campaignId: metadata?.campaignId,
                    leadId: metadata?.leadId,
                    eventType: "FAILED",
                    metadata: { provider: "SMTP", error: result.error },
                });
            }
            return result.error ? { success: false, error: result.error } : { success: false };
        }

        // Record in DB if we have context
        if (metadata?.leadId && metadata?.campaignId) {
            const email = await prisma.email.create({
                data: {
                    leadId: metadata.leadId,
                    campaignId: metadata.campaignId,
                    subject,
                    body,
                    status: "sent",
                    ...(result.messageId ? { providerId: result.messageId } : {}),
                    sentAt: new Date(),
                },
            });
            if (teamId) {
                await logEmailActivity({
                    teamId,
                    emailId: email.id,
                    campaignId: metadata.campaignId,
                    leadId: metadata.leadId,
                    messageId: result.messageId,
                    eventType: "SENT",
                    metadata: { provider: "SMTP" },
                });
            }
        }
        return result.messageId 
            ? { success: true, providerId: result.messageId }
            : { success: true };
    }
}

export const emailService = new EmailService();
