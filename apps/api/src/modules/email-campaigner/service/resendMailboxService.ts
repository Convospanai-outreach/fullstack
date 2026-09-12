/**
 * Resend mailbox sending — sibling to googleMailboxService.ts's Gmail-API path.
 * Reuses its mailbox-quota reservation so a team's daily/warmup limits are
 * enforced the same way regardless of which provider a mailbox uses.
 */
import { prisma } from "@/lib/db";
import { Resend } from "resend";
import { decryptCredential } from "@/lib/security/credentialVault";
import { reserveMailboxSend, releaseMailboxSend } from "./googleMailboxService";
import type { EmailAttachment } from "./emailAttachment";

export type ResendSendOutcome =
    | { success: true; deliveryProvider: "RESEND"; messageId: string; mailboxId: string }
    | { success: false; error: string; fallbackAllowed: boolean };

export async function sendViaResendMailbox(input: {
    teamId: string;
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    trackingId: string;
    unsubscribeUrl?: string;
    attachments?: EmailAttachment[];
}): Promise<ResendSendOutcome> {
    const mailbox = await prisma.connectedMailbox.findFirst({
        where: { id: input.mailboxId, teamId: input.teamId, status: "CONNECTED" },
    });
    if (!mailbox) return { success: false, error: "RESEND_SEND_PRE_DISPATCH_FAILED", fallbackAllowed: true };

    const apiKey = await decryptCredential(mailbox.encryptedAccessToken as any);
    if (!apiKey) return { success: false, error: "RESEND_SEND_PRE_DISPATCH_FAILED", fallbackAllowed: true };

    // Reserve the mailbox's daily send slot atomically, right before the actual provider
    // call — same race-avoidance reason as sendViaGmailMailbox (see OPEN-105). Released
    // below on any failure path.
    const reservation = await reserveMailboxSend(input.teamId, mailbox.id);
    if (!reservation.ok) return { success: false, error: "RESEND_SEND_PRE_DISPATCH_FAILED", fallbackAllowed: true };

    const fromName = mailbox.displayName || mailbox.email;
    const inboundDomain = (mailbox.metadata as any)?.inboundDomain as string | undefined;
    // Reply capture uses the same reply+<trackingId>@<inboundDomain> convention as
    // apps/web's ResendProvider.send(), so the shared /api/webhooks/resend route can
    // resolve replies to this email regardless of which app sent it.
    const replyTo = inboundDomain ? `reply+${input.trackingId}@${inboundDomain}` : undefined;

    try {
        const resend = new Resend(apiKey);
        const { data, error } = await resend.emails.send({
            from: `${fromName} <${mailbox.email}>`,
            to: input.to,
            subject: input.subject,
            html: input.html,
            ...(replyTo ? { replyTo } : {}),
            // RFC 8058 one-click unsubscribe: recognized by Gmail/Outlook/Yahoo as a real
            // "unsubscribe" affordance, which materially reduces spam-complaint rates.
            ...(input.unsubscribeUrl
                ? {
                      headers: {
                          "List-Unsubscribe": `<${input.unsubscribeUrl}>`,
                          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
                      },
                  }
                : {}),
            ...(input.attachments?.length
                ? {
                      attachments: input.attachments.map((a) => ({
                          filename: a.filename,
                          content: a.content,
                      })),
                  }
                : {}),
        });
        if (error || !data?.id) {
            await releaseMailboxSend(input.teamId, mailbox.id);
            return { success: false, error: "RESEND_SEND_FAILED", fallbackAllowed: true };
        }
        return { success: true, deliveryProvider: "RESEND", messageId: data.id, mailboxId: mailbox.id };
    } catch {
        await releaseMailboxSend(input.teamId, mailbox.id);
        return { success: false, error: "RESEND_SEND_FAILED", fallbackAllowed: true };
    }
}
