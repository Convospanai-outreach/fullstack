import { NextRequest, NextResponse } from "next/server";
import { sendViaSMTP } from "@/lib/email/smtpClient";

function getSystemSmtpConfig() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const password = process.env.SMTP_PASSWORD;
    if (!host || !user || !password) return null;

    const port = Number(process.env.SMTP_PORT || 587);
    const secure = (process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

    return {
        host,
        port,
        secure,
        user,
        password,
        fromName: process.env.SMTP_FROM_NAME || "CraftMyFunnel",
        fromEmail: process.env.SMTP_FROM_EMAIL || user
    };
}

export async function POST(req: NextRequest) {
    const body = await req.json();
    const { email, name, token } = body;
    if (!email || !token) return NextResponse.json({ error: "email and token required" }, { status: 400 });

    const config = getSystemSmtpConfig();
    if (!config) return NextResponse.json({ error: "SMTP not configured" }, { status: 500 });

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const verifyUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    const html = `
        <p>Hi ${name || "there"},</p>
        <p>Please verify your email to activate your CraftMyFunnel account:</p>
        <p><a href="${verifyUrl}">Verify Email</a></p>
        <p>If you did not request this, you can ignore this email.</p>
    `;

    const result = await sendViaSMTP(config, {
        to: email,
        subject: "Verify your email",
        html
    });

    if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });
}
