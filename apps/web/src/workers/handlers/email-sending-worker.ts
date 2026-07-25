import { logger } from "@/lib/logger";
import type { JobPayload } from "@/lib/queue";
import { advanceLeadAfterEmailSent } from "@/lib/crm/leadStageTransitions";
import { sendViaGmailMailbox } from "@/modules/email-campaigner/service/googleMailboxService";

function stripHtmlTags(input: string): string {
  let previous: string;
  let current = input;
  do {
    previous = current;
    current = current.replace(/<[^>]*>/g, "");
  } while (current !== previous);
  return current;
}

export async function handleEmailSending(payload: JobPayload) {
  const { leadId, campaignId, teamId, mailboxId } = payload;

  if (!leadId || !campaignId) {
    throw new Error("email_sending: leadId and campaignId are required");
  }

  const { prisma } = await import("@/lib/db");

  // 1. Load lead + campaign
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.email) throw new Error(`Lead ${leadId} has no email address`);

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  // 2. Check suppression list
  if (teamId) {
    const suppressed = await prisma.suppressionEntry.findUnique({
      where: { teamId_email: { teamId, email: lead.email } },
    });
    if (suppressed) {
      logger.warn("[email_sending] Lead on suppression list, skipping", { leadId, email: lead.email });
      return { skipped: true, reason: "suppressed" };
    }
  }

  // 3. Find active connected mailbox for team
  const mailbox = mailboxId
    ? await prisma.connectedMailbox.findUnique({ where: { id: mailboxId } })
    : await prisma.connectedMailbox.findFirst({
        where: { teamId: (teamId || campaign.teamId) as string, status: "CONNECTED" },
      });

  if (!mailbox) {
    throw new Error(`No connected mailbox available for team ${teamId || campaign.teamId}`);
  }

  // 3. Atomic conditional SQL UPDATE guaranteeing 100% race-free concurrency enforcement
  const updatedCount = await prisma.$executeRaw`
    UPDATE "ConnectedMailbox"
    SET "sentToday" = "sentToday" + 1, "lastSentAt" = NOW()
    WHERE id = ${mailbox.id}
      AND "sentToday" < "dailyLimit"
      AND ("lastSentAt" IS NULL OR "lastSentAt" <= NOW() - INTERVAL '180 seconds')
  `;

  if (Number(updatedCount) === 0) {
    const fresh = await prisma.connectedMailbox.findUnique({ where: { id: mailbox.id } });
    if (fresh && fresh.sentToday >= fresh.dailyLimit) {
      throw new Error(`Mailbox daily sending limit reached (${fresh.sentToday}/${fresh.dailyLimit}). Try again tomorrow.`);
    }
    throw new Error(`Mailbox sending delay throttle active (minimum 180s interval required).`);
  }

  const payloadSubject = payload["subject"];
  const payloadBody = payload["body"];

  // Check if an existing draft Email row exists for this lead & campaign
  const existingDraft = await prisma.email.findFirst({
    where: {
      leadId,
      campaignId,
      status: { in: ["draft", "DRAFT_READY", "queued"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const subject = typeof payloadSubject === "string" && payloadSubject.trim()
    ? payloadSubject.trim()
    : existingDraft?.subject || `Follow-up from ${campaign.name}`;
  const body = typeof payloadBody === "string" && payloadBody.trim()
    ? payloadBody.trim()
    : existingDraft?.body || "";

  // Reuse existing draft row or create a new queued Email record
  const email = existingDraft
    ? await prisma.email.update({
        where: { id: existingDraft.id },
        data: { mailboxId: mailbox.id, subject, body, status: "queued" },
      })
    : await prisma.email.create({
        data: {
          leadId,
          campaignId,
          mailboxId: mailbox.id,
          subject,
          body,
          status: "queued",
        },
      });

  const resolvedTeamId = teamId || campaign.teamId;
  if (!resolvedTeamId) {
    throw new Error(`No teamId available for campaign ${campaignId}`);
  }

  // 4. Send via provider registered with MailProviderFactory
  const { MailProviderFactory } = await import("@/modules/email-campaigner/providers");
  const providerKey = mailbox.provider || "GOOGLE_WORKSPACE";
  const provider = MailProviderFactory.getProvider(providerKey);

  let sendResult: any = null;
  try {
    sendResult = await provider.send(mailbox, {
      to: lead.email,
      from: mailbox.email,
      subject,
      html: body,
      text: stripHtmlTags(body),
      headers: {
        "Reply-To": mailbox.email,
        "X-Tracking-ID": email.trackingId || email.id,
      },
    });
  } catch (err: any) {
    await prisma.email.update({
      where: { id: email.id },
      data: { status: "failed" },
    });

    const isAuthExpired = err?.kind === "AUTH_EXPIRED";
    if (isAuthExpired) {
      await prisma.connectedMailbox.update({
        where: { id: mailbox.id },
        data: { status: "NEEDS_RECONNECT" },
      }).catch(() => undefined);
    }

    // Check consecutive send failures for circuit breaker (does not trip on AUTH_EXPIRED refresh attempts)
    if (!isAuthExpired) {
      const recentFailures = await prisma.email.count({
        where: {
          campaignId,
          status: "failed",
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
      });

      if (recentFailures >= 3) {
        await prisma.campaign.update({
          where: { id: campaignId },
          data: { status: "review_required" },
        });
        logger.error(`[Circuit Breaker] Tripped after ${recentFailures} send failures on campaign ${campaignId}`);
      }
    }

    throw new Error(err?.message || `${providerKey} send failed.`);
  }

  // 5. On successful send, update email status, lead status, and create SENT event
  const sent = await prisma.email.update({
    where: { id: email.id },
    data: {
      status: "sent",
      ...(sendResult?.providerMessageId ? { providerId: sendResult.providerMessageId } : {}),
      ...(sendResult?.threadId ? { threadId: sendResult.threadId } : {}),
    },
  });

  const sentAt = new Date();
  await prisma.emailEvent.create({
    data: {
      teamId: resolvedTeamId,
      emailId: sent.id,
      mailboxId: mailbox.id,
      leadId,
      campaignId,
      type: "SENT",
      provider: "GOOGLE_WORKSPACE",
      providerMessageId: sent.providerId || sent.id,
      payload: {
        threadId: sent.threadId,
        subject,
        sentAt: sentAt.toISOString(),
      },
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      status: "OUTREACH_SENT",
      campaignId,
    },
  });

  const leadStage = await advanceLeadAfterEmailSent(prisma, {
    leadId,
    teamId: resolvedTeamId,
    campaignId,
    emailId: sent.id,
  });

  logger.info("[email_sending] Email sent successfully via Gmail API", {
    emailId: sent.id,
    leadId,
    mailboxId: mailbox.id,
  });

  return {
    emailId: sent.id,
    status: "sent",
    providerId: sent.providerId,
    threadId: sent.threadId,
    leadStageChanged: leadStage.leadStageChanged,
    leadStatus: leadStage.leadStatus,
    pipelineState: leadStage.pipelineState,
  };
}
