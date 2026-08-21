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
import * as crypto from "crypto";

export type EmailSendResult = {
    success: boolean;
    providerId?: string;
    deliveryProvider?: "GMAIL_API" | "SMTP";
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
        if (!publicBaseUrl) return body;
        const baseUrl = publicBaseUrl.replace(/\/$/, "");
        const tracked = body.replace(/href=(["'])(https?:\/\/[^"']+)\1/gi, (_match, quote, href) => {
            const sig = signTrackedUrl(trackingId, href);
            const trackedHref = `${baseUrl}/api/proxy/email/track/click/${trackingId}?url=${encodeURIComponent(href)}&sig=${encodeURIComponent(sig)}`;
            return `href=${quote}${trackedHref}${quote}`;
        });
        // CAN-SPAM requires a physical postal address in every marketing email; omitted when the team hasn't set one.
        const addressLine = mailingAddress
            ? `<p style="font-size:12px;color:#64748b">${escapeHtml(mailingAddress)}</p>`
            : "";
        return `${tracked}
                <img src="${baseUrl}/api/proxy/email/track/open/${trackingId}" width="1" height="1" alt="" style="display:none" />
                <p style="font-size:12px;color:#64748b"><a href="${baseUrl}/api/proxy/email/unsubscribe/${trackingId}">Unsubscribe</a></p>
                ${addressLine}`;
    }

    private async persistDeliveredEmail(input: {
        metadata?: {
            leadId?: string;
            campaignId?: string;
        };
        subject: string;
        body: string;
        trackingId: string;
        deliveryProvider: "GMAIL_API" | "SMTP";
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
                mailboxId: input.deliveryProvider === "GMAIL_API" ? input.mailboxId : null,
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
        };
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

        const result = await sendViaSMTP(config, { to: input.to, subject: input.subject, html: input.body });
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
        }
    ): Promise<EmailSendResult> {
        const teamId = metadata?.teamId;
        if (teamId && await isSuppressed(teamId, to)) {
            return { success: false, error: "RECIPIENT_SUPPRESSED" };
        }
        if (metadata?.leadId) {
            const lead = await prisma.lead.findUnique({
                where: { id: metadata.leadId },
                select: { status: true },
            });
            const pausedStatuses = new Set(["replied", "stopped", "bounced", "unsubscribed", "do_not_contact"]);
            if (lead?.status && pausedStatuses.has(lead.status.toLowerCase())) {
                return { success: false, error: "LEAD_SEQUENCE_PAUSED" };
            }
        }

        const trackingId = crypto.randomUUID();
        const publicBaseUrl = process.env["WEB_BASE_URL"] || process.env["NEXTAUTH_URL"] || process.env["NEXT_PUBLIC_APP_URL"];
        const mailingAddress = teamId
            ? (await prisma.team.findUnique({ where: { id: teamId }, select: { mailingAddress: true } }))?.mailingAddress
            : undefined;
        const trackedBody = this.addTrackingLinks(body, trackingId, publicBaseUrl, mailingAddress);

        let gmailOutcome: GmailSendOutcome | undefined;

        if (teamId) {
            try {
                const mailbox = await selectMailboxForSend(teamId, metadata?.userId);
                if (mailbox) {
                    gmailOutcome = await sendViaGmailMailbox({
                        teamId,
                        mailboxId: mailbox.id,
                        to,
                        subject,
                        html: trackedBody,
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
        });
    }
}

export const emailService = new EmailService();
