import nodemailer from "nodemailer";

export interface SmtpConfig {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    fromName: string;
    fromEmail: string;
}

export interface SendMailOptions {
    to: string;
    subject: string;
    html: string;
    replyTo?: string;
    headers?: Record<string, string>;
}

export interface SendMailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

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

export const smtpClient = {
    sendMail: async (options: SendMailOptions, config: SmtpConfig): Promise<SendMailResult> => {
        return sendViaSMTP(config, options);
    }
};

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
            headers: options.headers,
        });
        return { success: true, messageId: info.messageId };
    } catch (err: any) {
        return { success: false, error: err?.message ?? String(err) };
    }
}

export async function verifySmtpConfig(config: SmtpConfig): Promise<{ ok: boolean; error?: string }> {
    const transporter = createSmtpTransport(config);
    try {
        await transporter.verify();
        return { ok: true };
    } catch (err: any) {
        return { ok: false, error: err?.message ?? String(err) };
    }
}
