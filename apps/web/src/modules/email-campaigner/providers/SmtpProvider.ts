import { MailProvider, SendEmailInput, SendEmailResult, MailProviderError } from "./MailProvider";
import { sendViaSMTP, verifySmtpConfig, SmtpConfig } from "@/lib/email/smtpClient";
import { decryptCredential } from "@/lib/security/credentialVault";
import crypto from "crypto";

export class SmtpProvider implements MailProvider {
  readonly providerKey = "SMTP" as const;

  private async buildConfig(mailbox: any): Promise<SmtpConfig> {
    const password = await decryptCredential(mailbox.encryptedAccessToken || mailbox.encryptedRefreshToken);
    const metadata = mailbox.metadata || {};
    return {
      host: metadata.host || process.env["SMTP_HOST"] || "smtp.gmail.com",
      port: Number(metadata.port || process.env["SMTP_PORT"] || 587),
      secure: metadata.secure ?? (Number(metadata.port) === 465),
      user: mailbox.email,
      password: password || "",
      fromName: mailbox.displayName || mailbox.email,
      fromEmail: mailbox.email,
    };
  }

  async verifyConnection(mailbox: any): Promise<{ ok: boolean; error?: string }> {
    try {
      const config = await this.buildConfig(mailbox);
      return await verifySmtpConfig(config);
    } catch (err: any) {
      return { ok: false, error: err?.message || "Failed to verify SMTP credentials." };
    }
  }

  async send(mailbox: any, input: SendEmailInput): Promise<SendEmailResult> {
    const config = await this.buildConfig(mailbox);
    const replyTo = input.headers?.["Reply-To"];
    const domain = mailbox.email.split("@")[1] || "craftmyfunnel.live";
    const rfcMessageId = `<${crypto.randomUUID()}@${domain}>`;

    const extraHeaders = { ...(input.headers || {}) };
    delete extraHeaders["Reply-To"];
    delete extraHeaders["X-Tracking-ID"];

    const sendOptions = {
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(replyTo ? { replyTo } : {}),
      ...(Object.keys(extraHeaders).length ? { headers: extraHeaders } : {}),
    };

    const result = await sendViaSMTP(config, sendOptions);

    if (!result.success) {
      const msg = result.error || "SMTP send failed";
      const isTransient = msg.includes("ETIMEDOUT") || msg.includes("ECONNRESET") || msg.includes("421");
      const isAuth = msg.includes("EAUTH") || msg.includes("535");
      throw new MailProviderError(
        msg,
        isAuth ? "AUTH_EXPIRED" : isTransient ? "TRANSIENT" : "REJECTED",
        isTransient || isAuth,
        result
      );
    }

    return {
      providerMessageId: result.messageId || rfcMessageId,
      sentAt: new Date(),
    };
  }

  supportsNativeReplyDetection(): boolean {
    return false; // Forces fallback to IMAP reply polling worker
  }

  async refreshAuthIfNeeded(_mailbox: any): Promise<void> {
    // Static credentials — no-op
  }
}
