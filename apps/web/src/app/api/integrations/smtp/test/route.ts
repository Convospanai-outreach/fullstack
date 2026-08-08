import { NextRequest, NextResponse } from "next/server";
import { sendViaSMTP } from "@/lib/email/smtpClient";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { host, port, secure, user, password, fromName, email, recipientEmail } = body;

    if (!host || !port || !user || !password || !email || !recipientEmail) {
      return NextResponse.json({ error: "Missing required parameters for test email dispatch." }, { status: 400 });
    }

    const smtpConfig = {
      host: String(host).trim(),
      port: Number(port),
      secure: Boolean(secure),
      user: String(user).trim(),
      password: String(password),
      fromName: String(fromName || email).trim(),
      fromEmail: String(email).trim().toLowerCase(),
    };

    const sendResult = await sendViaSMTP(smtpConfig, {
      to: String(recipientEmail).trim(),
      subject: "CraftMyFunnel — Custom SMTP Connection Verification Test",
      html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#2563eb;margin-top:0;">SMTP Connection Test</h2>
        <p>This is a real verification test email sent from your custom SMTP server (<code>${smtpConfig.host}:${smtpConfig.port}</code>) connected to CraftMyFunnel.</p>
        <p style="color:#64748b;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
      </div>`,
    });

    if (!sendResult.success) {
      return NextResponse.json({ error: sendResult.error || "SMTP test email send failed." }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: sendResult.messageId });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error during SMTP test send." }, { status: 500 });
  }
}
