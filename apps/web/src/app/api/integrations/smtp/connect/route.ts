import { NextRequest, NextResponse } from "next/server";
import { verifySmtpConfig } from "@/lib/email/smtpClient";
import { encryptCredential } from "@/lib/security/credentialVault";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { host, port, secure, user, password, fromName, email } = body;

    if (!host || !port || !user || !password || !email) {
      return NextResponse.json({ error: "Missing required SMTP connection parameters." }, { status: 400 });
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

    // 1. Verify SMTP connection before persisting credentials
    const verification = await verifySmtpConfig(smtpConfig);
    if (!verification.ok) {
      return NextResponse.json({ error: verification.error || "SMTP verification failed. Check credentials." }, { status: 400 });
    }

    const { prisma } = await import("@/lib/db");

    // 2. Encrypt SMTP password via credentialVault.ts
    const encryptedPassword = await encryptCredential(password);

    // 3. Upsert ConnectedMailbox with provider: 'SMTP'
    const mailbox = await prisma.connectedMailbox.upsert({
      where: { teamId_email: { teamId, email: smtpConfig.fromEmail } },
      create: {
        teamId,
        provider: "SMTP",
        authType: "BASIC",
        email: smtpConfig.fromEmail,
        displayName: smtpConfig.fromName,
        status: "CONNECTED",
        encryptedAccessToken: encryptedPassword as any,
        dailyLimit: 50,
        minDelaySeconds: 180,
        metadata: {
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
        },
      },
      update: {
        status: "CONNECTED",
        encryptedAccessToken: encryptedPassword as any,
        displayName: smtpConfig.fromName,
        metadata: {
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
        },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, mailboxId: mailbox.id, email: mailbox.email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error during SMTP connection." }, { status: 500 });
  }
}
