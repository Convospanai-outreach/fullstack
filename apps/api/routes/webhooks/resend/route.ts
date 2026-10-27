import { NextRequest, NextResponse } from "next/server";
import { logWebhookRejected } from "@/lib/webhookRejection";
import { verifySvixSignature } from "@/lib/webhooks/verifySvixSignature";
import { decryptCredential } from "@/lib/security/credentialVault";
import {
  advanceLeadAfterEmailOpened,
  advanceLeadAfterEmailClicked,
  advanceLeadAfterReply,
} from "@/lib/crm/leadStageTransitions";
import { internalErrorMessage } from "@/lib/internalError";

// Moved here from apps/web (which sleeps on Render's free tier, delaying webhook
// delivery/retries) so this always-on apps/api service receives Resend's webhooks
// directly. See apps/web/src/app/(dashboard)/settings/mailboxes/page.tsx for the
// webhook URL shown to users, and apps/web/src/app/setup/page.tsx for the other
// reference to it.

export const runtime = "nodejs";

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    from?: string;
    subject?: string;
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

// A click or reply is the strongest engagement signal a lead can produce - re-score
// immediately so intentScore/leadScore/churnRisk/clusterLabel (and pipeline-state
// auto-advancement) reflect it right away instead of waiting for the next batch
// scoring run or a manual "Rescore" click on the lead detail page. Best-effort:
// scoring failure must never fail the webhook itself.
async function rescoreLead(leadId: string | null): Promise<void> {
  if (!leadId) return;
  try {
    const { leadScoringService } = await import("@/modules/scoring/service/LeadScoringService");
    await leadScoringService.scoreAndPersist(leadId);
  } catch {
    // best-effort
  }
}

function stripHtml(html: string): string {
  return html
    // Match closing tags with any whitespace before ">" (e.g. "</script >"), and an
    // unterminated <script>/<style> block through to the end of the string, so no
    // raw markup or script source can survive into the plain-text preview.
    .replace(/<style[\s\S]*?(<\/style\s*>|$)/gi, "")
    .replace(/<script[\s\S]*?(<\/script\s*>|$)/gi, "")
    .replace(/<[^>]+>/g, " ")
    // Defense in depth: escape any angle brackets a malformed tag left behind, so
    // the result can never be re-interpreted as markup by a downstream renderer.
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\s+/g, " ")
    .trim();
}

// Resend's "email.received" webhook payload only carries metadata (from/to/subject/message_id) -
// the actual reply text/html has to be fetched separately via the receiving-emails API, using
// this specific mailbox's own Resend API key (each team brings its own Resend account).
async function fetchReceivedEmailBody(mailbox: { encryptedAccessToken: unknown }, emailId?: string | null): Promise<{ content: string; from: string } | null> {
  if (!emailId) return null;
  try {
    const apiKey = await decryptCredential(mailbox.encryptedAccessToken as any);
    if (!apiKey) return null;
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.receiving.get(emailId);
    if (error || !data) return null;
    const content = data.text?.trim() || (data.html ? stripHtml(data.html) : "");
    return { content, from: data.from };
  } catch {
    return null;
  }
}

/**
 * Every team brings its own Resend account, its own inbound-receiving domain, and its own
 * webhook signing secret (stored per-mailbox, see /integrations/resend/connect). This
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
    logWebhookRejected(req, "resend", "missing_signature", rawBody.length);
    return NextResponse.json({ error: "Missing Svix signature headers." }, { status: 400 });
  }
  const valid = verifySvixSignature({ secret: webhookSecret, svixId, svixTimestamp, svixSignature, rawBody });
  if (!valid) {
    logWebhookRejected(req, "resend", "invalid_signature", rawBody.length);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  const { prisma } = await import("@/lib/db");
  const advanceParams = { leadId: email.leadId, teamId, campaignId: email.campaignId, emailId: email.id };

  const emailEventData = (type: string) => ({
    teamId,
    emailId: email.id,
    mailboxId: mailbox.id,
    leadId: email.leadId,
    campaignId: email.campaignId,
    type,
    provider: "RESEND",
    providerMessageId: event.data?.email_id || null,
    payload: event.data as any,
  });

  // EmailEvent is unique per (team, provider, provider message id, type), so a redelivery's
  // event insert is a duplicate; any other error fails the webhook and Resend retries it.
  const recordEmailEvent = (type: string) =>
    prisma.emailEvent.create({ data: emailEventData(type) }).catch((error: any) => {
      if (error?.code !== "P2002") throw error;
    });

  try {
    switch (event.type) {
      case "email.opened": {
        // Webhook providers redeliver at-least-once. The updateMany guard makes the claim
        // atomic, so only the delivery that flips the flag proceeds (OPEN-107). The claim,
        // lead-stage advance and EmailEvent share one transaction: if a side effect fails,
        // the claim rolls back too, and Resend's retry can do the work.
        await prisma.$transaction(async (tx) => {
          const claimed = await tx.email.updateMany({ where: { id: email.id, openedAt: null }, data: { openedAt: new Date() } });
          if (claimed.count === 0) return;
          await advanceLeadAfterEmailOpened(tx, advanceParams);
          await tx.emailEvent.create({ data: emailEventData("OPENED") });
        });
        break;
      }
      case "email.clicked": {
        const claimed = await prisma.$transaction(async (tx) => {
          const result = await tx.email.updateMany({ where: { id: email.id, clickedAt: null }, data: { clickedAt: new Date() } });
          if (result.count === 0) return false;
          await advanceLeadAfterEmailClicked(tx, advanceParams);
          await tx.emailEvent.create({ data: emailEventData("CLICKED") });
          return true;
        });
        if (claimed) await rescoreLead(email.leadId);
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
          // A lead deleted since the send is fine to skip; any other failure is retried.
          await prisma.lead.update({ where: { id: email.leadId }, data: { status: "OPT_OUT" } }).catch((error: any) => {
            if (error?.code !== "P2025") throw error;
          });
        }
        await recordEmailEvent("COMPLAINED");
        break;
      }
      case "email.received": {
        // Each reply is its own inbound email, so dedupe on its id (the EmailEvent unique
        // key), not on the sent email's repliedAt: that let only a lead's first reply in.
        const inboundEmailId = event.data?.email_id;
        if (!inboundEmailId) {
          console.warn("[ResendWebhook] email.received without email_id; skipped");
          return NextResponse.json({ ok: true, skipped: true, reason: "missing_email_id" });
        }
        const body = await fetchReceivedEmailBody(mailbox, inboundEmailId);

        // Same parity as the Gmail/IMAP reply paths: a Message row is what actually makes
        // the reply show up in the Inbox UI. The event goes first, so a redelivery fails on
        // the unique key before touching the lead.
        let inboundMessage;
        try {
          inboundMessage = await prisma.$transaction(async (tx) => {
            const emailEvent = await tx.emailEvent.create({ data: emailEventData("REPLY_RECEIVED") });
            await tx.email.updateMany({ where: { id: email.id, repliedAt: null }, data: { repliedAt: new Date() } });
            await advanceLeadAfterReply(tx, advanceParams);
            return tx.message.create({
              data: {
                leadId: email.leadId,
                content: body?.content || event.data?.subject || "Reply detected",
                direction: "INBOUND",
                platform: "EMAIL",
                sender: body?.from || event.data?.from || "",
                status: "received",
                isRead: false,
                emailEventId: emailEvent.id,
              },
            });
          });
        } catch (error: any) {
          if (error?.code === "P2002") return NextResponse.json({ ok: true, duplicate: true });
          throw error;
        }

        const { onInboundReply } = await import("@/modules/inbox/inboundReplyNotifier");
        void onInboundReply(inboundMessage);
        await rescoreLead(email.leadId);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    // A 500 makes Resend redeliver; nothing above is left half-written.
    return NextResponse.json({ error: internalErrorMessage(error, "Could not process the webhook event") }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
