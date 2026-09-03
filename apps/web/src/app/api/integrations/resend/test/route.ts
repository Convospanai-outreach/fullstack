import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { apiKey, fromName, email, recipientEmail } = body;

    if (!apiKey || !email || !recipientEmail) {
      return NextResponse.json({ error: "Missing required parameters for test email dispatch." }, { status: 400 });
    }

    const fromEmail = String(email).trim().toLowerCase();
    const displayName = String(fromName || fromEmail).trim();
    const resend = new Resend(String(apiKey).trim());

    const { data, error } = await resend.emails.send({
      from: `${displayName} <${fromEmail}>`,
      to: String(recipientEmail).trim(),
      subject: "CraftMyFunnel — Resend Connection Verification Test",
      html: `<div style="font-family:sans-serif;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
        <h2 style="color:#2563eb;margin-top:0;">Resend Connection Test</h2>
        <p>This is a real verification test email sent via Resend from <code>${fromEmail}</code> connected to CraftMyFunnel.</p>
        <p style="color:#64748b;font-size:12px;">Sent at: ${new Date().toISOString()}</p>
      </div>`,
    });

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Resend test email send failed." }, { status: 400 });
    }

    return NextResponse.json({ success: true, messageId: data.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error during Resend test send." }, { status: 500 });
  }
}
