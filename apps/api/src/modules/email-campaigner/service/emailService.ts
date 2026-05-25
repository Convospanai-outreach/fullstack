/**
 * Campaign email sending.
 *
 * Prefers connected Google Workspace mailboxes, then falls back to the legacy
 * encrypted team SMTP config so existing setups keep working.
 */
import { prisma } from "@/lib/db";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { getSmtpConfig } from "./smtpConfigService";
import { isSuppressed, selectMailboxForSend, sendViaGmailMailbox, signTrackedUrl } from "./googleMailboxService";
import * as crypto from "crypto";

export type EmailSendResult = {
    success: boolean;
    providerId?: string;
    error?: string;
};

class EmailService {
    private addTrackingLinks(body: string, trackingId: string, publicBaseUrl?: string) {
        if (!publicBaseUrl) return body;
        const baseUrl = publicBaseUrl.replace(/\/$/, "");
        const tracked = body.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote, href) => {
            const sig = signTrackedUrl(trackingId, href);
            const trackedHref = `${baseUrl}/api/proxy/email/track/click/${trackingId}?url=${encodeURIComponent(href)}&sig=${encodeURIComponent(sig)}`;
            return `href=${quote}${trackedHref}${quote}`;
        });
        return `${tracked}
                <img src="${baseUrl}/api/proxy/email/track/open/${trackingId}" width="1" height="1" alt="" style="display:none" />
                <p style="font-size:12px;color:#64748b"><a href="${baseUrl}/api/proxy/email/unsubscribe/${trackingId}">Unsubscribe</a></p>`;
    }

    async sendEmail(
        to: string,
        subject: string,
        body: string,
        metadata?: {
            leadId?: string;
            campaignId?: string;
            teamId?: string;
            userId?: string;
            fromName?: string;
            fromEmail?: string;
        }
    ): Promise<EmailSendResult> {
        const teamId = metadata?.teamId;
        if (teamId && await isSuppressed(teamId, to)) {
            return { success: false, error: "Recipient is suppressed for this team." };
        }
        if (metadata?.leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: metadata.leadId },
                select: { status: true },
            });
            const pausedStatuses = new Set(["replied", "bounced", "unsubscribed", "do_not_contact"]);
            if (lead?.status && pausedStatuses.has(lead.status.toLowerCase())) {
                return { success: false, error: `Sequence paused for lead status: ${lead.status}.` };
            }
        }

        const trackingId = crypto.randomUUID();
        const publicBaseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || process.env["NEXT_PUBLIC_APP_URL"];
        const trackedBody = this.addTrackingLinks(body, trackingId, publicBaseUrl);

        let result: any = null;
        let mailboxId: string | undefined;

        if (teamId) {
            const mailbox = await selectMailboxForSend(teamId, metadata?.userId);
            if (mailbox) {
                result = await sendViaGmailMailbox({
                    teamId,
                    mailboxId: mailbox.id,
                    to,
                    subject,
                    html: trackedBody,
                });
                mailboxId = mailbox.id;
            }
        }

        if (!result?.success) {
            let config = null;
            try {
                config = teamId ? await getSmtpConfig(teamId) : null;
            } catch (error: any) {
                const errMsg = error?.message || "Failed to load SMTP configuration.";
                console.error(`[EmailService] ${errMsg}`);
                return { success: false, error: result?.error || errMsg };
            }

            if (!config) {
                const errMsg = teamId
                    ? `No Google mailbox or SMTP config found for team ${teamId}. Configure email in Setup -> Step 3.`
                    : "No teamId provided for email send.";
                console.error(`[EmailService] ${errMsg}`);
                return { success: false, error: result?.error || errMsg };
            }

            result = await sendViaSMTP(config, { to, subject, html: trackedBody });
        }

        if (!result.success) {
            return result.error ? { success: false, error: result.error } : { success: false };
        }

        if (metadata?.leadId && metadata?.campaignId) {
            await prisma.email.create({
                data: {
                    leadId: metadata.leadId,
                    campaignId: metadata.campaignId,
                    subject,
                    body: trackedBody,
                    status: "sent",
                    trackingId,
                    mailboxId,
                    ...(result.threadId ? { threadId: result.threadId } : {}),
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
