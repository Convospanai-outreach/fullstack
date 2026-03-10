/**
 * emailService.ts (email-campaigner module)
 * Real SMTP-powered email sending for campaign outreach.
 * Replaces the previous SendPulse mock stub.
 */
import { prisma } from "@/lib/db";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { getSmtpConfig } from "./smtpConfigService";

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

        // Lookup SMTP config
        const config = teamId ? await getSmtpConfig(teamId) : null;
        if (!config) {
            const errMsg = teamId
                ? `No SMTP config found for team ${teamId}. Configure email in Setup → Step 3.`
                : "No teamId provided for email send.";
            console.error(`[EmailService] ${errMsg}`);
            return { success: false, error: errMsg };
        }

        const result = await sendViaSMTP(config, { to, subject, html: body });

        if (!result.success) {
            return result.error ? { success: false, error: result.error } : { success: false };
        }

        // Record in DB if we have context
        if (metadata?.leadId && metadata?.campaignId) {
            await prisma.email.create({
                data: {
                    leadId: metadata.leadId,
                    campaignId: metadata.campaignId,
                    subject,
                    body,
                    status: "sent",
                    ...(result.messageId ? { providerId: result.messageId } : {}),
                },
            });
        }
        return result.messageId 
            ? { success: true, providerId: result.messageId }
            : { success: true };
    }
}

export const emailService = new EmailService();
