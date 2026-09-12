/**
 * Campaign email sending.
 *
 * Prefers connected Google Workspace mailboxes, then falls back to the legacy
 * encrypted team SMTP config so existing setups keep working.
 */
import { prisma } from "@/lib/db";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { getSmtpConfig } from "./smtpConfigService";
import {
    isSuppressed,
    selectMailboxForSend,
    sendViaGmailMailbox,
    signTrackedUrl,
    type GmailSendOutcome,
} from "./googleMailboxService";
import { sendViaResendMailbox, type ResendSendOutcome } from "./resendMailboxService";
import type { EmailAttachment } from "./emailAttachment";
import * as crypto from "crypto";

export type EmailSendResult = {
    success: boolean;
    providerId?: string;
    deliveryProvider?: "GMAIL_API" | "SMTP" | "RESEND";
    error?: string;
};

function escapeHtml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

class EmailService {
    private addTrackingLinks(body: string, trackingId: string, publicBaseUrl?: string, mailingAddress?: string | null) {
        // CAN-SPAM requires a physical postal address in every marketing email; omitted when the team hasn't set one.
        const addressLine = mailingAddress
            ? `<p style="font-size:12px;color:#64748b">${escapeHtml(mailingAddress)}</p>`
            : "";
        const unsubscribeUrl = publicBaseUrl
            ? `${publicBaseUrl.replace(/\/$/, "")}/api/proxy/email/unsubscribe/${trackingId}`
            : undefined;
        // Mandatory, prominent anti-spam footer on every send (unconditional — must NOT depend on
        // publicBaseUrl/tracking being configured): steers recipients to unsubscribe or forward
        // rather than hitting "report spam", which is what actually hurts sender reputation.
        const unsubscribeInstruction = unsubscribeUrl
            ? `instead click <a href="${unsubscribeUrl}" style="color:#0f172a;text-decoration:underline">UNSUBSCRIBE</a> and we will ensure you never receive another email from us.`
            : `instead reply to this email with "UNSUBSCRIBE" and we will ensure you never receive another email from us.`;
        const antiSpamFooter = `
                <table role="presentation" width="100%" style="margin-top:20px;border-top:2px solid #1e293b">
                    <tr><td style="padding-top:14px">
                        <p style="font-size:13px;line-height:1.5;color:#0f172a;font-weight:700;margin:0 0 8px 0">
                            If you don't want to receive emails from us, please do NOT mark this as SPAM &mdash;
                            ${unsubscribeInstruction}
                        </p>
                        <p style="font-size:13px;line-height:1.5;color:#0f172a;font-weight:700;margin:0">
                            If this isn't relevant to you, please forward it to the right person at your company instead of deleting it or marking it as spam.
                            Our intent is professional partnership &mdash; not to bother you.
                        </p>
                    </td></tr>
                </table>`;

        if (!publicBaseUrl) {
            return `${body}
                ${antiSpamFooter}
                ${addressLine}`;
        }

        const baseUrl = publicBaseUrl.replace(/\/$/, "");
        const tracked = body.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote, href) => {
            const sig = signTrackedUrl(trackingId, href);
            const trackedHref = `${baseUrl}/api/proxy/email/track/click/${trackingId}?url=${encodeURIComponent(href)}&sig=${encodeURIComponent(sig)}`;
            return `href=${quote}${trackedHref}${quote}`;
        });
        return `${tracked}
                <img src="${baseUrl}/api/proxy/email/track/open/${trackingId}" width="1" height="1" alt="" style="display:none" />
                <p style="font-size:12px;color:#64748b"><a href="${unsubscribeUrl}">Unsubscribe</a></p>
                ${antiSpamFooter}
                ${addressLine}`;
    }

    private async persistDeliveredEmail(input: {
        metadata?: {
            leadId?: string;
            campaignId?: string;
            variantId?: string;
        };
        subject: string;
        body: string;
        trackingId: string;
        deliveryProvider: "GMAIL_API" | "SMTP" | "RESEND";
        mailboxId?: string;
        providerId?: string;
        threadId?: string;
    }) {
        if (!input.metadata?.leadId || !input.metadata.campaignId) return;

        await prisma.email.create({
            data: {
                leadId: input.metadata.leadId,
                campaignId: input.metadata.campaignId,
                subject: input.subject,
                body: input.body,
                status: "sent",
                trackingId: input.trackingId,
                deliveryProvider: input.deliveryProvider,
                mailboxId: input.deliveryProvider === "GMAIL_API" || input.deliveryProvider === "RESEND" ? input.mailboxId : null,
                ...(input.metadata.variantId ? { variantId: input.metadata.variantId } : {}),
                ...(input.providerId ? { providerId: input.providerId } : {}),
                ...(input.deliveryProvider === "GMAIL_API" && input.threadId ? { threadId: input.threadId } : {}),
            } as any,
        });
    }

    private async sendViaSmtpAndPersist(input: {
        teamId?: string;
        to: string;
        subject: string;
        body: string;
        trackingId: string;
        metadata?: {
            leadId?: string;
            campaignId?: string;
            variantId?: string;
        };
        attachments?: EmailAttachment[];
    }): Promise<EmailSendResult> {
        let config: any;
        try {
            config = input.teamId ? await getSmtpConfig(input.teamId) : null;
        } catch {
            console.error("[EmailService] SMTP_CONFIG_UNAVAILABLE.");
            return { success: false, error: "SMTP_CONFIG_UNAVAILABLE" };
        }

        if (!config) {
            return { success: false, error: "SMTP_CONFIG_UNAVAILABLE" };
        }

        const result = await sendViaSMTP(config, {
            to: input.to,
            subject: input.subject,
            html: input.body,
            ...(input.attachments?.length ? { attachments: input.attachments } : {}),
        });
        if (!result.success) {
            return { success: false, error: "SMTP_SEND_FAILED" };
        }

        await this.persistDeliveredEmail({
            metadata: input.metadata,
            subject: input.subject,
            body: input.body,
            trackingId: input.trackingId,
            deliveryProvider: "SMTP",
            providerId: result.messageId,
        });
        return {
            success: true,
            ...(result.messageId ? { providerId: result.messageId } : {}),
            deliveryProvider: "SMTP",
        };
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
            variantId?: string;
            mailboxId?: string;
        }
    ): Promise<EmailSendResult> {
        const teamId = metadata?.teamId;
        if (teamId && await isSuppressed(teamId, to)) {
            return { success: false, error: "RECIPIENT_SUPPRESSED" };
        }
        if (metadata?.leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: metadata.leadId },
                select: { status: true, teamId: true },
            });
            if (teamId && lead && lead.teamId !== teamId) {
                return { success: false, error: "LEAD_TEAM_MISMATCH" };
            }
            const pausedStatuses = new Set(["replied", "stopped", "bounced", "unsubscribed", "do_not_contact"]);
            if (lead?.status && pausedStatuses.has(lead.status.toLowerCase())) {
                return { success: false, error: "LEAD_SEQUENCE_PAUSED" };
            }
        }
        if (metadata?.campaignId && teamId) {
            const campaign = await prisma.campaign.findUnique({
                where: { id: metadata.campaignId },
                select: { teamId: true },
            });
            if (campaign && campaign.teamId !== teamId) {
                return { success: false, error: "CAMPAIGN_TEAM_MISMATCH" };
            }
        }

        const trackingId = crypto.randomUUID();
        const publicBaseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || process.env["NEXT_PUBLIC_APP_URL"];
        const mailingAddress = teamId
            ? (await prisma.team.findUnique({ where: { id: teamId }, select: { mailingAddress: true } }))?.mailingAddress
            : undefined;
        const trackedBody = this.addTrackingLinks(body, trackingId, publicBaseUrl, mailingAddress);
        const unsubscribeUrl = publicBaseUrl
            ? `${publicBaseUrl.replace(/\/$/, "")}/api/proxy/email/unsubscribe/${trackingId}`
            : undefined;
        const attachments: EmailAttachment[] = metadata?.campaignId
            ? await prisma.campaignAttachment.findMany({
                  where: { campaignId: metadata.campaignId },
                  select: { filename: true, mimeType: true, content: true },
              })
            : [];

        let gmailOutcome: GmailSendOutcome | undefined;
        let resendOutcome: ResendSendOutcome | undefined;

        if (teamId) {
            try {
                // A drip-sequence run assigns a specific sender mailbox up front (from the
                // sequence's configured senderMailboxIds) and already re-validated it can
                // send right before calling in — honor that exact mailbox instead of letting
                // selectMailboxForSend re-pick across every connected mailbox on the team,
                // which would silently ignore the sender the operator chose (including Resend).
                const mailbox = metadata?.mailboxId
                    ? await prisma.connectedMailbox.findFirst({
                          where: { id: metadata.mailboxId, teamId, status: "CONNECTED" },
                      })
                    : await selectMailboxForSend(teamId, metadata?.userId);
                if (mailbox?.provider === "RESEND") {
                    resendOutcome = await sendViaResendMailbox({
                        teamId,
                        mailboxId: mailbox.id,
                        to,
                        subject,
                        html: trackedBody,
                        trackingId,
                        unsubscribeUrl,
                        attachments,
                    });
                } else if (mailbox) {
                    gmailOutcome = await sendViaGmailMailbox({
                        teamId,
                        mailboxId: mailbox.id,
                        to,
                        subject,
                        html: trackedBody,
                        unsubscribeUrl,
                        attachments,
                    });
                }
            } catch {
                gmailOutcome = {
                    success: false,
                    error: "GMAIL_SEND_PRE_DISPATCH_FAILED",
                    outcome: "PRE_DISPATCH_NO_SEND",
                    fallbackAllowed: true,
                };
            }
        }

        if (resendOutcome?.success) {
            await this.persistDeliveredEmail({
                metadata,
                subject,
                body: trackedBody,
                trackingId,
                deliveryProvider: "RESEND",
                mailboxId: resendOutcome.mailboxId,
                providerId: resendOutcome.messageId,
            });
            return {
                success: true,
                providerId: resendOutcome.messageId,
                deliveryProvider: "RESEND",
            };
        }

        if (resendOutcome && !resendOutcome.fallbackAllowed) {
            return { success: false, error: resendOutcome.error };
        }

        if (gmailOutcome?.success) {
            await this.persistDeliveredEmail({
                metadata,
                subject,
                body: trackedBody,
                trackingId,
                deliveryProvider: "GMAIL_API",
                mailboxId: gmailOutcome.mailboxId,
                providerId: gmailOutcome.messageId,
                threadId: gmailOutcome.threadId,
            });
            return {
                success: true,
                providerId: gmailOutcome.messageId,
                deliveryProvider: "GMAIL_API",
            };
        }

        if (gmailOutcome && !gmailOutcome.fallbackAllowed) {
            return { success: false, error: gmailOutcome.error };
        }

        return this.sendViaSmtpAndPersist({
            teamId,
            to,
            subject,
            body: trackedBody,
            trackingId,
            metadata,
            attachments,
        });
    }
}

export const emailService = new EmailService();
