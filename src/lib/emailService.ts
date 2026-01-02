import { sendEmailViaSendPulse } from "@/integrations/sendpulse";
import crypto from 'crypto';
import { prisma } from './db';

export class EmailService {
    static async sendEmail(
        to: string,
        subject: string,
        body: string,
        fromName?: string,
        fromEmail?: string
    ) {
        console.log(`[EmailService] Sending email to ${to}`);

        // Use provided sender, or env vars, or fallback
        const senderName = fromName || process.env['SMTP_FROM_NAME'] || "ConvoSpan User";
        const senderEmail = fromEmail || process.env['SMTP_FROM_EMAIL'] || "noreply@convospan.com";

        try {
            const result = await sendEmailViaSendPulse(to, subject, body, senderName, senderEmail);
            return { success: true, result };
        } catch (error: any) {
            console.error("[EmailService] Failed to send email:", error);
            // Fallback to mock if SendPulse fails (for dev/demo reliability)
            // In prod, you might want to throw error
            return { success: false, error: error.message || error };
        }
    }

    /**
     * Generate a secure random verification token
     */
    static generateToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Create verification token in database
     */
    static async createVerificationToken(email: string): Promise<string> {
        const token = this.generateToken();
        const expires = new Date();
        expires.setHours(expires.getHours() + 24); // 24 hour expiry

        // Delete any existing tokens for this email
        await prisma.verificationToken.deleteMany({
            where: { identifier: email }
        });

        // Create new token
        await prisma.verificationToken.create({
            data: {
                identifier: email,
                token,
                expires
            }
        });

        return token;
    }

    /**
     * Verify token and mark email as verified
     */
    static async verifyToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
        const verificationToken = await prisma.verificationToken.findUnique({
            where: { token }
        });

        if (!verificationToken) {
            return { success: false, error: 'Invalid or expired verification link' };
        }

        // Check if expired
        if (verificationToken.expires < new Date()) {
            await prisma.verificationToken.delete({ where: { token } });
            return { success: false, error: 'Verification link has expired' };
        }

        // Update user's emailVerified field
        await prisma.user.update({
            where: { email: verificationToken.identifier },
            data: { emailVerified: new Date() }
        });

        // Delete used token
        await prisma.verificationToken.delete({ where: { token } });

        return { success: true, email: verificationToken.identifier };
    }

    /**
     * Send verification email
     */
    static async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
        const verificationUrl = this.getVerificationUrl(token);
        const subject = 'Verify your email address';
        const body = this.getVerificationEmailTemplate(name, verificationUrl);

        const result = await this.sendEmail(email, subject, body, 'ConvoSpan', 'noreply@convospan.com');

        if (!result.success) {
            console.warn('Failed to send verification email, but continuing. Link:', verificationUrl);
        }
    }

    /**
     * Get verification URL
     */
    private static getVerificationUrl(token: string): string {
        const baseUrl = process.env['NEXTAUTH_URL'] || 'http://localhost:3000';
        return `${baseUrl}/verify-email?token=${token}`;
    }

    /**
     * Email template for verification
     */
    private static getVerificationEmailTemplate(name: string, verificationUrl: string): string {
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 40px;">
                    <tr>
                        <td align="center" style="padding-bottom: 32px;">
                            <h1 style="color: #ffffff; font-size: 32px; font-weight: 700; margin: 0;">ConvoSpan</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="color: #e2e8f0; font-size: 16px; line-height: 24px; padding-bottom: 24px;">
                            <p style="margin: 0 0 16px 0;">Hi ${name},</p>
                            <p style="margin: 0 0 16px 0;">Thanks for signing up! Please verify your email address to get started with ConvoSpan.</p>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding: 24px 0;">
                            <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                                Verify Email Address
                            </a>
                        </td>
                    </tr>
                    <tr>
                        <td style="color: #94a3b8; font-size: 14px; line-height: 20px; padding-top: 24px; border-top: 1px solid rgba(255, 255, 255, 0.1);">
                            <p style="margin: 0 0 8px 0;">Or copy and paste this link:</p>
                            <p style="margin: 0; word-break: break-all;">
                                <a href="${verificationUrl}" style="color: #60a5fa;">${verificationUrl}</a>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="color: #64748b; font-size: 12px; line-height: 18px; padding-top: 32px; text-align: center;">
                            <p style="margin: 0 0 8px 0;">This link will expire in 24 hours.</p>
                            <p style="margin: 0;">If you didn't create an account, you can safely ignore this email.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `.trim();
    }
}
