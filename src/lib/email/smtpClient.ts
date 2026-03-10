/**
 * smtpClient.ts
 * Stateless Nodemailer SMTP transport factory.
 * Creates a fresh transporter per invocation — safe for serverless/edge environments.
 */
import nodemailer from "nodemailer";

export interface SmtpConfig {
    host: string;       // e.g. smtp.gmail.com
    port: number;       // 587 (STARTTLS) or 465 (SSL)
    secure: boolean;    // true for port 465, false for 587
    user: string;       // Gmail address
    password: string;   // App Password (or account password for non-Gmail)
    fromName: string;   // Display name, e.g. "Jane Doe"
    fromEmail: string;  // Sender address (usually same as user for Gmail)
}

export interface SendMailOptions {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
}

export interface SendMailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

/**
 * Creates a Nodemailer transporter from config.
 * Does NOT verify the connection — use verifySmtpConfig() for that.
 */
export function createSmtpTransport(config: SmtpConfig): nodemailer.Transporter {
    return nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        auth: {
            user: config.user,
            pass: config.password,
        },
    });
}

/**
 * Send a single email using the provided SMTP config.
 * Returns a result object — never throws.
 */
export async function sendViaSMTP(
    config: SmtpConfig,
    options: SendMailOptions
): Promise<SendMailResult> {
    const transporter = createSmtpTransport(config);
    try {
        const info = await transporter.sendMail({
            from: `"${config.fromName}" <${config.fromEmail}>`,
            to: options.to,
            subject: options.subject,
            html: options.html,
            replyTo: options.replyTo,
        });
        return { success: true, messageId: info.messageId };
    } catch (err: any) {
        return { success: false, error: err?.message ?? String(err) };
    }
}

/**
 * Verify SMTP credentials by opening and closing a connection.
 * Used by the setup wizard "Test Connection" flow.
 */
export async function verifySmtpConfig(config: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
    const transporter = createSmtpTransport(config);
    try {
        await transporter.verify();
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err?.message ?? String(err) };
    }
}
