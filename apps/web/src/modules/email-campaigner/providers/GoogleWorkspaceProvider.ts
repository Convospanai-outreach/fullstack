import { MailProvider, SendEmailInput, SendEmailResult, MailProviderError } from "./MailProvider";
import { sendViaGmailMailbox } from "../service/googleMailboxService";

export class GoogleWorkspaceProvider implements MailProvider {
  readonly providerKey = "GOOGLE_WORKSPACE" as const;

  async verifyConnection(mailbox: any): Promise<{ ok: boolean; error?: string }> {
    if (!mailbox || mailbox.status !== "CONNECTED") {
      return { ok: false, error: "Mailbox status is not CONNECTED." };
    }
    return { ok: true };
  }

  async send(mailbox: any, input: SendEmailInput): Promise<SendEmailResult> {
    const replyTo = input.headers?.["Reply-To"];
    const sendInput = {
      teamId: String(mailbox.teamId),
      mailboxId: String(mailbox.id),
      to: input.to,
      subject: input.subject,
      html: input.html,
      ...(replyTo ? { replyTo } : {}),
    };

    const result = await sendViaGmailMailbox(sendInput);

    if (!result.success) {
      const err = result.error || "Gmail send failed.";
      const isAuthError = err.toLowerCase().includes("reconnect") || err.toLowerCase().includes("token");
      throw new MailProviderError(
        err,
        isAuthError ? "AUTH_EXPIRED" : "REJECTED",
        isAuthError,
        result
      );
    }

    return {
      providerMessageId: result.messageId || `gmail_${Date.now()}`,
      sentAt: new Date(),
      ...(result.threadId ? { threadId: result.threadId } : {}),
    };
  }

  supportsNativeReplyDetection(): boolean {
    return true; // Supports PubSub change notifications
  }

  async refreshAuthIfNeeded(_mailbox: any): Promise<void> {
    // Auth refresh is handled internally by sendViaGmailMailbox
  }
}
