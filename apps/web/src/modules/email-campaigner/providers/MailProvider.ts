export interface EmailAttachment {
  filename: string;
  mimeType: string;
  content: string; // base64-encoded file content
}

export interface SendEmailInput {
  to: string;
  from: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  // Only SmtpProvider and ResendProvider forward these today (see each provider's
  // send() for details) - GoogleWorkspaceProvider and MicrosoftGraphProvider silently
  // ignore this field for now, a known gap, not something this change attempts to fix.
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  providerMessageId: string;
  sentAt: Date;
  threadId?: string;
}

export type MailProviderErrorKind = "AUTH_EXPIRED" | "RATE_LIMITED" | "REJECTED" | "TRANSIENT" | "UNKNOWN";

export class MailProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: MailProviderErrorKind,
    public readonly retryable: boolean,
    public readonly providerRaw?: unknown
  ) {
    super(message);
    this.name = "MailProviderError";
  }
}

export interface MailProvider {
  readonly providerKey: "GOOGLE_WORKSPACE" | "MICROSOFT_365" | "SMTP" | "RESEND";

  verifyConnection(mailbox: any): Promise<{ ok: boolean; error?: string }>;
  send(mailbox: any, input: SendEmailInput): Promise<SendEmailResult>;
  supportsNativeReplyDetection(): boolean;
  refreshAuthIfNeeded(mailbox: any): Promise<void>;
}
