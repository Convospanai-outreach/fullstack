import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { encryptCredential } from "@/lib/security/credentialVault";
import { getCurrentContext } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { apiKey, fromName, email, inboundDomain, webhookSecret } = body;

    if (!apiKey || !email) {
      return NextResponse.json({ error: "Missing required Resend connection parameters." }, { status: 400 });
    }

    const trimmedKey = String(apiKey).trim();
    const fromEmail = String(email).trim().toLowerCase();
    const displayName = String(fromName || fromEmail).trim();
    const trimmedInboundDomain = inboundDomain ? String(inboundDomain).trim().toLowerCase() : undefined;
    const trimmedWebhookSecret = webhookSecret ? String(webhookSecret).trim() : undefined;

    // 1. Verify the API key before persisting credentials
    const resend = new Resend(trimmedKey);
    const { error } = await resend.apiKeys.list();
    if (error) {
      return NextResponse.json({ error: error.message || "Resend API key verification failed." }, { status: 400 });
    }

    const { prisma } = await import("@/lib/db");

    // 2. Encrypt the Resend API key (and reply-webhook secret, if provided) via credentialVault.ts
    const encryptedKey = await encryptCredential(trimmedKey);
    const encryptedWebhookSecret = trimmedWebhookSecret ? await encryptCredential(trimmedWebhookSecret) : undefined;

    // 3. Upsert ConnectedMailbox with provider: 'RESEND'.
    // Reply capture is per-tenant: each team brings its own Resend account, verifies its own
    // inbound-receiving domain, and pastes back its own webhook signing secret from its Resend
    // dashboard — CraftMyFunnel only relays events for the domain/secret this team registered.
    const mailbox = await prisma.connectedMailbox.upsert({
      where: { teamId_email: { teamId, email: fromEmail } },
      create: {
        teamId,
        provider: "RESEND",
        authType: "API_KEY",
        email: fromEmail,
        displayName,
        status: "CONNECTED",
        encryptedAccessToken: encryptedKey as any,
        ...(encryptedWebhookSecret ? { encryptedRefreshToken: encryptedWebhookSecret as any } : {}),
        dailyLimit: 50,
        minDelaySeconds: 180,
        ...(trimmedInboundDomain ? { metadata: { inboundDomain: trimmedInboundDomain } } : {}),
      },
      update: {
        status: "CONNECTED",
        encryptedAccessToken: encryptedKey as any,
        ...(encryptedWebhookSecret ? { encryptedRefreshToken: encryptedWebhookSecret as any } : {}),
        displayName,
        ...(trimmedInboundDomain ? { metadata: { inboundDomain: trimmedInboundDomain } } : {}),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, mailboxId: mailbox.id, email: mailbox.email });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal server error during Resend connection." }, { status: 500 });
  }
}
