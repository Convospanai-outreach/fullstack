import { Resend } from "resend";
import { MailProvider, SendEmailInput, SendEmailResult, MailProviderError } from "./MailProvider";
import { decryptCredential } from "@/lib/security/credentialVault";

export class ResendProvider implements MailProvider {
  readonly providerKey = "RESEND" as const;

  private async getApiKey(mailbox: any): Promise<string> {
    // Note: encryptedRefreshToken holds this mailbox's reply-webhook signing secret for Resend
    // (see connect route), NOT a fallback API key — unlike SMTP, do not fall back to it here.
    const apiKey = await decryptCredential(mailbox.encryptedAccessToken);
    if (!apiKey) throw new Error("Resend API key is missing for this mailbox.");
    return apiKey;
  }

  async verifyConnection(mailbox: any): Promise<{ ok: boolean; error?: string }> {
    try {
      const apiKey = await this.getApiKey(mailbox);
      const resend = new Resend(apiKey);
      const { error } = await resend.apiKeys.list();
      if (error) return { ok: false, error: error.message || "Invalid Resend API key." };
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Failed to verify Resend API key." };
    }
  }

  async send(mailbox: any, input: SendEmailInput): Promise<SendEmailResult> {
    const apiKey = await this.getApiKey(mailbox);
    const resend = new Resend(apiKey);
    const fromName = mailbox.displayName || mailbox.email;

    // Reply capture is per-tenant and opt-in: only route replies through a tracked plus-address
    // when this team has registered their own verified inbound-receiving domain for this mailbox.
    const inboundDomain = mailbox.metadata?.inboundDomain;
    const trackingId = input.headers?.["X-Tracking-ID"];
    const replyTo = inboundDomain && trackingId
      ? `reply+${trackingId}@${inboundDomain}`
      : input.headers?.["Reply-To"];

    const extraHeaders = { ...(input.headers || {}) };
    delete extraHeaders["Reply-To"];
    delete extraHeaders["X-Tracking-ID"];

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${mailbox.email}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      ...(replyTo ? { replyTo } : {}),
      ...(Object.keys(extraHeaders).length ? { headers: extraHeaders } : {}),
    });

    if (error || !data) {
      const message = error?.message || "Resend send failed";
      const name = (error as any)?.name || "";
      const isAuth = name === "invalid_api_key" || name === "restricted_api_key" || name === "missing_api_key";
      const isRateLimited = name === "rate_limit_exceeded" || name === "daily_quota_exceeded";
      const isTransient = name === "application_error" || name === "internal_server_error";
      throw new MailProviderError(
        message,
        isAuth ? "AUTH_EXPIRED" : isRateLimited ? "RATE_LIMITED" : isTransient ? "TRANSIENT" : "REJECTED",
        isAuth || isRateLimited || isTransient,
        error
      );
    }

    return {
      providerMessageId: data.id,
      sentAt: new Date(),
    };
  }

  supportsNativeReplyDetection(): boolean {
    // Not IMAP-pollable like SMTP. Reply capture (if configured) instead flows through
    // /api/webhooks/resend's "email.received" handling via a per-mailbox inbound domain.
    return false;
  }

  async refreshAuthIfNeeded(_mailbox: any): Promise<void> {
    // Static API key — no-op
  }
}
