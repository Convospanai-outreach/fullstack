import { NextRequest, NextResponse } from "next/server";
import { verifySvixSignature } from "@/lib/webhooks/verifySvixSignature";
import { decryptCredential } from "@/lib/security/credentialVault";
import {
  advanceLeadAfterEmailOpened,
  advanceLeadAfterEmailClicked,
  advanceLeadAfterReply,
} from "@/lib/crm/leadStageTransitions";

export const runtime = "nodejs";

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    click?: { link?: string };
  };
}

// Matches the plus-addressed reply-to ResendProvider generates: reply+<trackingId>@<team's own inbound domain>
const REPLY_ADDRESS_PATTERN = /^reply\+([^@]+)@/i;

function extractTrackingIdFromReceivedEvent(event: ResendWebhookEvent): string | null {
  for (const address of event.data?.to || []) {
    const match = REPLY_ADDRESS_PATTERN.exec(address.trim());
    if (match) return match[1] as string;
  }
  return null;
}

/**
 * Every team brings its own Resend account, its own inbound-receiving domain, and its own
 * webhook signing secret (stored per-mailbox, see /api/integrations/resend/connect). This
 * endpoint is a single shared broker for all tenants, so it must identify which mailbox/team
 * an incoming event belongs to BEFORE it can know which secret to verify the signature against.
 */
async function resolveCandidateMailbox(event: ResendWebhookEvent) {
  const { prisma } = await import("@/lib/db");

  const emailSelect = {
    id: true,
    leadId: true,
    campaignId: true,
    mailboxId: true,
    openedAt: true,
    clickedAt: true,
    repliedAt: true,
  } as const;

  if (event.type === "email.received") {
    const trackingId = extractTrackingIdFromReceivedEvent(event);
    if (!trackingId) return null;
    const email = await prisma.email.findFirst({
      where: { OR: [{ id: trackingId }, { trackingId }] },
      select: emailSelect,
    });
    if (!email?.mailboxId) return null;
    const mailbox = await prisma.connectedMailbox.findUnique({ where: { id: email.mailboxId } });
    return mailbox ? { email, mailbox } : null;
  }

  const emailId = event.data?.email_id;
  if (!emailId) return null;
  const email = await prisma.email.findFirst({
    where: { providerId: emailId },
    select: emailSelect,
  });
  if (!email?.mailboxId) return null;
  const mailbox = await prisma.connectedMailbox.findUnique({ where: { id: email.mailboxId } });
  return mailbox ? { email, mailbox } : null;
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const candidate = await resolveCandidateMailbox(event);
  if (!candidate) {
    return NextResponse.json({ ok: true, skipped: true });
  }
  const { email, mailbox } = candidate;
  const teamId = mailbox.teamId;

  // This mailbox's own webhook signing secret (pasted back from its own Resend dashboard) is
  // required to trust this payload. No secret on file means we never configured/verified this
  // tenant's webhook — do not act on unverified data, even though we now know who it "claims" to be for.
  const webhookSecret = await decryptCredential(mailbox.encryptedRefreshToken as any);
  if (!webhookSecret) {
    return NextResponse.json({ ok: true, skipped: true, reason: "no_webhook_secret_configured" });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing Svix signature headers." }, { status: 400 });
  }
  const valid = verifySvixSignature({ secret: webhookSecret, svixId, svixTimestamp, svixSignature, rawBody });
  if (!valid) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/db");
  const advanceParams = { leadId: email.leadId, teamId, campaignId: email.campaignId, emailId: email.id };

  const recordEmailEvent = (type: string) =>
    prisma.emailEvent.create({
      data: {
        teamId,
        emailId: email.id,
        mailboxId: mailbox.id,
        leadId: email.leadId,
        campaignId: email.campaignId,
        type,
        provider: "RESEND",
        providerMessageId: event.data?.email_id || null,
        payload: event.data as any,
      },
    }).catch(() => undefined);

  switch (event.type) {
    case "email.opened": {
      // Webhook providers redeliver at-least-once, so a plain read-then-write here (read
      // openedAt, decide, write) could let two concurrent deliveries both see it unset and
      // both fire the lead-stage side effect. updateMany with the guard in the WHERE clause
      // makes the claim atomic - only the delivery that actually flips the flag proceeds.
      // The EmailEvent write is gated behind the same claim so a redelivery doesn't also
      // double-count analytics after the lead-stage race was already fixed (OPEN-107).
      const claimed = await prisma.email.updateMany({ where: { id: email.id, openedAt: null }, data: { openedAt: new Date() } });
      if (claimed.count > 0) {
        await advanceLeadAfterEmailOpened(prisma, advanceParams).catch(() => undefined);
        await recordEmailEvent("OPENED");
      }
      break;
    }
    case "email.clicked": {
      const claimed = await prisma.email.updateMany({ where: { id: email.id, clickedAt: null }, data: { clickedAt: new Date() } });
      if (claimed.count > 0) {
        await advanceLeadAfterEmailClicked(prisma, advanceParams).catch(() => undefined);
        await recordEmailEvent("CLICKED");
      }
      break;
    }
    case "email.bounced": {
      await prisma.email.update({ where: { id: email.id }, data: { bouncedAt: new Date(), status: "bounced" } });
      await recordEmailEvent("BOUNCED");
      break;
    }
    case "email.complained": {
      const recipientEmail = event.data?.to?.[0]?.toLowerCase().trim();
      if (recipientEmail) {
        await prisma.suppressionEntry.upsert({
          where: { teamId_email: { teamId, email: recipientEmail } },
          create: { teamId, email: recipientEmail, reason: "SPAM_COMPLAINT", source: "RESEND_WEBHOOK", leadId: email.leadId },
          update: { reason: "SPAM_COMPLAINT", source: "RESEND_WEBHOOK", leadId: email.leadId },
        });
        await prisma.lead.update({ where: { id: email.leadId }, data: { status: "OPT_OUT" } }).catch(() => undefined);
      }
      await recordEmailEvent("COMPLAINED");
      break;
    }
    case "email.received": {
      const claimed = await prisma.email.updateMany({ where: { id: email.id, repliedAt: null }, data: { repliedAt: new Date() } });
      if (claimed.count > 0) {
        await advanceLeadAfterReply(prisma, advanceParams).catch(() => undefined);
        await recordEmailEvent("REPLY_RECEIVED");
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ ok: true });
}
