import { MailProvider, SendEmailInput, SendEmailResult, MailProviderError } from "./MailProvider";
import { decryptCredential, encryptCredential } from "@/lib/security/credentialVault";
import crypto from "crypto";

export class MicrosoftGraphProvider implements MailProvider {
  readonly providerKey = "MICROSOFT_365" as const;

  private async getAccessToken(mailbox: any): Promise<string> {
    const accessToken = await decryptCredential(mailbox.encryptedAccessToken);
    if (accessToken && mailbox.tokenExpiresAt && new Date(mailbox.tokenExpiresAt) > new Date(Date.now() + 60_000)) {
      return accessToken;
    }
    return this.refreshAccessToken(mailbox);
  }

  private async refreshAccessToken(mailbox: any): Promise<string> {
    const refreshToken = await decryptCredential(mailbox.encryptedRefreshToken);
    if (!refreshToken) {
      throw new MailProviderError("Microsoft refresh token missing. Reconnect required.", "AUTH_EXPIRED", true);
    }

    const tenantId = mailbox.metadata?.tenantId || "common";
    const clientId = process.env["MICROSOFT_CLIENT_ID"];
    const clientSecret = process.env["MICROSOFT_CLIENT_SECRET"];

    if (!clientId || !clientSecret) {
      throw new MailProviderError("MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET must be configured.", "UNKNOWN", false);
    }

    const response = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        scope: "offline_access Mail.Send openid profile",
      }),
    });

    const data = (await response.json()) as any;
    if (!response.ok) {
      throw new MailProviderError(
        data?.error_description || data?.error || "Microsoft OAuth token refresh failed.",
        "AUTH_EXPIRED",
        true
      );
    }

    const { prisma } = await import("@/lib/db");
    const encryptedAccessToken = await encryptCredential(data.access_token);
    const tokenExpiresAt = data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null;

    await prisma.connectedMailbox.update({
      where: { id: mailbox.id },
      data: {
        encryptedAccessToken: encryptedAccessToken as any,
        tokenExpiresAt,
        status: "CONNECTED",
      },
    });

    return data.access_token;
  }

  async verifyConnection(mailbox: any): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.getAccessToken(mailbox);
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err?.message || "Microsoft 365 connection invalid." };
    }
  }

  async send(mailbox: any, input: SendEmailInput): Promise<SendEmailResult> {
    const token = await this.getAccessToken(mailbox);
    const domain = mailbox.email.split("@")[1] || "craftmyfunnel.live";
    const rfcMessageId = `<${crypto.randomUUID()}@${domain}>`;

    const payload = {
      message: {
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.html,
        },
        toRecipients: [
          {
            emailAddress: {
              address: input.to,
            },
          },
        ],
        internetMessageHeaders: [
          {
            name: "Message-ID",
            value: rfcMessageId,
          },
          ...(input.headers?.["Reply-To"]
            ? [
                {
                  name: "Reply-To",
                  value: input.headers["Reply-To"],
                },
              ]
            : []),
        ],
      },
      saveToSentItems: "true",
    };

    const response = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new MailProviderError("Graph API rate limit exceeded.", "RATE_LIMITED", true);
    }

    if (response.status === 401) {
      throw new MailProviderError("Microsoft 365 token expired mid-send.", "AUTH_EXPIRED", true);
    }

    if (!response.ok) {
      const errText = await response.text();
      throw new MailProviderError(`Graph API send failed: ${response.status} ${errText}`, "REJECTED", false);
    }

    return {
      providerMessageId: rfcMessageId,
      sentAt: new Date(),
    };
  }

  supportsNativeReplyDetection(): boolean {
    return true; // Graph supports delta change notifications
  }

  async refreshAuthIfNeeded(mailbox: any): Promise<void> {
    await this.getAccessToken(mailbox);
  }
}
