
import crypto from "crypto";
import { sendViaSMTP } from "@/lib/email/smtpClient";
import { prisma } from "@/lib/db";

const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");
const isServer = typeof window === "undefined";

export class EmailService {
    static generateToken(): string {
        return crypto.randomBytes(32).toString("hex");
    }

    static async sendEmail(
        to: string,
        subject: string,
        body: string,
        fromName?: string,
        fromEmail?: string,
        teamId?: string
    ) {
        const res = await fetch(`${API_URL}/email/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ to, subject, html: body, body, fromName, fromEmail, teamId })
        });
        return await res.json();
    }

    static async createVerificationToken(email: string): Promise<string> {
        if (isServer || !API_URL) {
            await prisma.verificationToken.deleteMany({ where: { identifier: email } });
            const token = this.generateToken();
            const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);
            await prisma.verificationToken.create({
                data: { identifier: email, token, expires }
            });
            return token;
        }
        const res = await fetch(`${API_URL}/email/verification-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        return data.token;
    }

    static async generateTokenForEmail(email: string): Promise<string> {
        return this.createVerificationToken(email);
    }

    static async verifyToken(token: string): Promise<{ success: boolean; email?: string; error?: string }> {
        if (isServer || !API_URL) {
            const record = await prisma.verificationToken.findUnique({ where: { token } });
            if (!record) {
                return { success: false, error: "Invalid or expired verification link" };
            }
            if (record.expires < new Date()) {
                await prisma.verificationToken.delete({ where: { token } });
                return { success: false, error: "Verification link has expired" };
            }
            await prisma.user.update({
                where: { email: record.identifier },
                data: { emailVerified: new Date() }
            });
            await prisma.verificationToken.delete({ where: { token } });
            return { success: true, email: record.identifier };
        }
        const res = await fetch(`${API_URL}/email/verify-token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token })
        });
        return await res.json();
    }

    static async sendVerificationEmail(email: string, name: string, token: string): Promise<void> {
        if (isServer || !API_URL) {
            const host = process.env["SMTP_HOST"] || "localhost";
            const user = process.env["SMTP_USER"] || "noreply@localhost";
            const password = process.env["SMTP_PASSWORD"] || process.env["SMTP_PASS"] || "local";
            const port = Number(process.env["SMTP_PORT"] || 587);
            const secure = (process.env["SMTP_SECURE"] || "").toLowerCase() === "true" || port === 465;
            const fromName = process.env["SMTP_FROM_NAME"] || "CraftMyFunnel";
            const fromEmail = process.env["SMTP_FROM_EMAIL"] || user;
            const baseUrl = process.env["NEXTAUTH_URL"] || "http://localhost:3000";
            const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;
            const html = `
                <p>Hi ${(name || "there").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)},</p>
                <p>Please verify your email to finish creating your ${fromName} account:</p>
                <p><a href="${verifyUrl}">Verify Email</a></p>
                <p>If the button doesn't work, copy this link into your browser:<br>${verifyUrl}</p>
                <p>The link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>
            `;
            // A plain-text part alongside the HTML: HTML-only mail scores worse with spam filters.
            const text = [
                `Hi ${name || "there"},`,
                "",
                `Please verify your email to finish creating your ${fromName} account:`,
                verifyUrl,
                "",
                "The link expires in 24 hours. If you didn't sign up, you can ignore this email.",
            ].join("\n");
            // sendViaSMTP reports failure in its result instead of throwing; surface it so the
            // callers can tell the user and the server log shows why.
            const result = await sendViaSMTP({ host, port, secure, user, password, fromName, fromEmail }, {
                to: email,
                subject: "Verify your email",
                html,
                text
            });
            if (!result.success) {
                throw new Error(`Verification email was not sent via ${host}:${port}: ${result.error ?? "unknown error"}`);
            }
            return;
        }
        await fetch(`${API_URL}/email/send-verification`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, name, token })
        });
    }
}
