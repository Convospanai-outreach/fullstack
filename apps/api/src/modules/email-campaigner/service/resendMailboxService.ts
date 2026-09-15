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

// Resend's own retry guidance (https://resend.com/docs/knowledge-base/what-if-my-email-fails-to-send):
// 429 (rate_limit_exceeded) and 500 (internal_server_error) are transient - retry with
// backoff. Everything else (validation_error, invalid_api_key, invalid_parameter, etc.)
// is a permanent rejection that will fail again identically on retry. sequenceService's
// isRetryableEmailError() pattern-matches this exact wording on the returned error string.
// Matches apps/web's ResendProvider.ts classification exactly (RATE_LIMITED:
// rate_limit_exceeded/daily_quota_exceeded, TRANSIENT: application_error/internal_server_error).
const RETRYABLE_RESEND_ERROR_CODES = new Set([
    "rate_limit_exceeded",
    "daily_quota_exceeded",
    "application_error",
    "internal_server_error",
]);

function resendErrorToMessage(errorName: string | undefined): string {
    if (errorName && RETRYABLE_RESEND_ERROR_CODES.has(errorName)) {
        return `RESEND_SEND_FAILED: temporary Resend error (${errorName}), try again`;
    }
    return `RESEND_SEND_FAILED${errorName ? `: ${errorName}` : ""}`;
}

export async function sendViaResendMailbox(input: {
    teamId: string;
    mailboxId: string;
    to: string;
    subject: string;
    html: string;
    trackingId: string;
    unsubscribeUrl?: string;
    attachments?: EmailAttachment[];
    // Stable across retries of the same logical send (e.g. a sequence step run's
    // id) so a transient failure that retries the same send can't double-send a
    // real email to the recipient - Resend dedupes on this for 24h. See
    // https://resend.com/docs/api-reference/emails/send-email#idempotent-requests
    idempotencyKey?: string;
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
        const { data, error } = await resend.emails.send(
            {
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
                              contentType: a.mimeType,
                          })),
                      }
                    : {}),
            },
            input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined
        );
        if (error || !data?.id) {
            await releaseMailboxSend(input.teamId, mailbox.id);
            return { success: false, error: resendErrorToMessage(error?.name), fallbackAllowed: true };
        }
        return { success: true, deliveryProvider: "RESEND", messageId: data.id, mailboxId: mailbox.id };
    } catch {
        // A thrown exception here is a network/transport failure (timeout, DNS, TLS)
        // during the actual HTTP call to Resend - unlike a Resend-returned `error`
        // (whose API contract guarantees the send was rejected, never dispatched),
        // we genuinely don't know whether Resend received and processed the request
        // before the response was lost. fallbackAllowed MUST be false here: falling
        // through to an immediate SMTP send would risk a real duplicate with zero
        // idempotency protection (that only covers retries against Resend itself).
        // The caller's own retry (same idempotencyKey) is the safe way to recover.
        await releaseMailboxSend(input.teamId, mailbox.id);
        return { success: false, error: "RESEND_SEND_FAILED: network error, try again", fallbackAllowed: false };
    }
}
