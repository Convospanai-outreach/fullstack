import crypto from "crypto";
import { logger } from "@/lib/logger";
import type { JobPayload } from "@/lib/queue";
import { advanceLeadAfterEmailSent } from "@/lib/crm/leadStageTransitions";
import { sendViaGmailMailbox } from "@/modules/email-campaigner/service/googleMailboxService";
import { renderMergeTags } from "@/lib/email/mergeTags";
import { pickWeightedVariant } from "@/lib/email/campaignVariants";
import { buildUnsubscribeHeaders, appendUnsubscribeFooter } from "@/lib/email/unsubscribeHeaders";
import { buildOpenPixelHtml, rewriteLinksForTracking } from "@/lib/email/linkTracking";
import { ALWAYS_HOLD_CODES, preSendCheck, resolveSendSafety } from "@/lib/preSendCheck";

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

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { variants: true },
  });
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

  // 2b. Recipient send window (team setting sendSafety.sendWindow, off unless enabled). Outside the window the same
  // job is queued again for the next window start, so nothing is dropped and no daily slot is used yet. If the
  // settings cannot be read the email is sent, as it was before.
  let enqueueFailure: unknown = null;
  try {
    const windowTeamId = (teamId || campaign.teamId) as string;
    const team = await prisma.team.findUnique({ where: { id: windowTeamId }, select: { sendSafety: true } });
    const rawWindow = team?.sendSafety && typeof team.sendSafety === "object" ? (team.sendSafety as Record<string, unknown>)["sendWindow"] : null;
    const sendWindow = resolveSendWindow(rawWindow);
    if (sendWindow.enabled) {
      const { timeZone, source } = resolveRecipientTimeZone(lead, sendWindow.timeZone);
      const retryAt = nextSendTime(new Date(), timeZone, sendWindow, `${leadId}:${campaignId}`);
      if (retryAt) {
        const { JobQueue } = await import("@/lib/queue");
        try {
          await JobQueue.enqueue("email_sending", payload, {
            processAt: retryAt,
            teamId: windowTeamId,
            idempotencyKey: `email_sending_window_${leadId}_${campaignId}_${retryAt.getTime()}`,
          });
        } catch (enqueueErr) {
          // A concurrent handler won the insert for the same key: that delayed job exists, so this one is done.
          // Any other failure is rethrown so the job is retried, never sent now, outside the window.
          if ((enqueueErr as { code?: string })?.code !== "P2002") {
            enqueueFailure = enqueueErr;
            throw enqueueErr;
          }
        }
        logger.info("[email_sending] Outside the recipient's send window, queued again", { leadId, campaignId, retryAt: retryAt.toISOString(), timeZone, source });
        return { skipped: true, reason: "outside_send_window", retryAt: retryAt.toISOString() };
      }
    }
  } catch (err) {
    if (enqueueFailure) throw enqueueFailure;
    logger.warn("[email_sending] Send window skipped", { leadId, error: err instanceof Error ? err.message : String(err) });
  }

  // 3. Find active connected mailbox for team
  const resolvedMailboxTeamId = (teamId || campaign.teamId) as string;
  const mailbox = mailboxId
    ? await prisma.connectedMailbox.findFirst({ where: { id: mailboxId, teamId: resolvedMailboxTeamId } })
    : await prisma.connectedMailbox.findFirst({
        where: { teamId: resolvedMailboxTeamId, status: "CONNECTED" },
      });

  if (!mailbox) {
    throw new Error(`No connected mailbox available for team ${teamId || campaign.teamId}`);
  }

  // 3. Atomic conditional SQL UPDATE guaranteeing 100% race-free concurrency enforcement.
  // Mirrors googleMailboxService.ts's assertMailboxCanSend/bumpMailboxCounters on apps/api:
  // sentToday resets on day rollover, the per-send delay honors the mailbox's own
  // minDelaySeconds, and a mailbox still warming up is capped at a ramped limit instead of
  // its full dailyLimit.
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const effectiveLimit = mailbox.isWarmingUp
    ? Math.max(5, Math.min(mailbox.dailyLimit, 5 + mailbox.warmupDay * 5))
    : mailbox.dailyLimit;
  const minDelaySeconds = mailbox.minDelaySeconds ?? 180;

  const updatedCount = await prisma.$executeRaw`
    UPDATE "ConnectedMailbox"
    SET "sentToday" = CASE WHEN "sentTodayDate" IS NULL OR "sentTodayDate" < ${todayStart} THEN 1 ELSE "sentToday" + 1 END,
        "sentTodayDate" = ${todayStart},
        "lastSentAt" = NOW()
    WHERE id = ${mailbox.id}
      AND (CASE WHEN "sentTodayDate" IS NULL OR "sentTodayDate" < ${todayStart} THEN 0 ELSE "sentToday" END) < ${effectiveLimit}
      AND ("lastSentAt" IS NULL OR "lastSentAt" <= NOW() - make_interval(secs => ${minDelaySeconds}))
  `;

  if (Number(updatedCount) === 0) {
    const fresh = await prisma.connectedMailbox.findUnique({ where: { id: mailbox.id } });
    const freshSentToday = fresh?.sentTodayDate && fresh.sentTodayDate >= todayStart ? fresh.sentToday : 0;
    if (fresh && freshSentToday >= effectiveLimit) {
      const limitLabel = mailbox.isWarmingUp ? `${freshSentToday}/${effectiveLimit} warmup limit` : `${freshSentToday}/${effectiveLimit}`;
      throw new Error(`Mailbox daily sending limit reached (${limitLabel}). Try again tomorrow.`);
    }
    throw new Error(`Mailbox sending delay throttle active (minimum ${minDelaySeconds}s interval required).`);
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

  const hasExplicitContent = (typeof payloadSubject === "string" && payloadSubject.trim())
    || (typeof payloadBody === "string" && payloadBody.trim())
    || existingDraft?.body;

  // A/B: pick a weighted variant only when nothing else already supplied content for this send
  const selectedVariant = !hasExplicitContent && campaign.variants.length > 0
    ? pickWeightedVariant(campaign.variants)
    : null;

  const rawSubject = typeof payloadSubject === "string" && payloadSubject.trim()
    ? payloadSubject.trim()
    : existingDraft?.subject || selectedVariant?.subject || `Follow-up from ${campaign.name}`;
  const rawBody = typeof payloadBody === "string" && payloadBody.trim()
    ? payloadBody.trim()
    : existingDraft?.body || selectedVariant?.body || "";

  const subject = renderMergeTags(rawSubject, lead);
  const body = renderMergeTags(rawBody, lead);

  // Deterministic pre-send gate on the composed text, before link tracking, the pixel and the footer.
  // Team setting sendSafety.mode: off skips it, warn logs and sends, hold stops this send. If the team
  // cannot be read the email is sent, as it was before the gate existed.
  const gateTeamId = (teamId || campaign.teamId) as string;
  let heldReasons: { code: string; message: string }[] | null = null;
  let postalAddress: string | null = null;
  try {
    const team = await prisma.team.findUnique({ where: { id: gateTeamId }, select: { sendSafety: true, mailingAddress: true } });
    postalAddress = team?.mailingAddress ?? null;
    const settings = resolveSendSafety(team?.sendSafety);
    if (settings.mode !== "off") {
      const check = preSendCheck({ to: lead.email, subject, body, kind: "sequence", settings, postalAddress: team?.mailingAddress ?? null, emailStatus: lead.emailStatus });
      // Warn mode only logs, except for an address known to be undeliverable: that never goes out.
      const always = check.reasons.filter((r) => (ALWAYS_HOLD_CODES as string[]).includes(r.code));
      if (!check.ok && settings.mode === "warn" && always.length === 0) {
        logger.warn("[email_sending] Pre-send check would hold this email", { leadId, campaignId, codes: check.reasons.map((r) => r.code) });
      } else if (!check.ok) {
        heldReasons = settings.mode === "warn" ? always : check.reasons;
      }
    }
  } catch (err) {
    logger.warn("[email_sending] Pre-send check skipped", { leadId, error: err instanceof Error ? err.message : String(err) });
  }
  if (heldReasons) {
    // Give back the daily-limit slot taken above: nothing was sent.
    // Only on the day the slot was taken: if midnight passed meanwhile, today's counter never held it.
    await prisma.$executeRaw`UPDATE "ConnectedMailbox" SET "sentToday" = GREATEST("sentToday" - 1, 0) WHERE id = ${mailbox.id} AND "sentTodayDate" = ${todayStart}`;
    // Codes only: the reasons quote the email text, which does not belong in the audit trail.
    await prisma.auditLog.create({
      data: {
        orgId: gateTeamId,
        actorId: "SYSTEM",
        action: "SEND_SAFETY_HELD",
        entity: "Lead",
        entityId: leadId,
        metadata: { campaignId, codes: heldReasons.map((r) => r.code) },
      },
    });
    logger.warn("[email_sending] Held by the pre-send check", { leadId, campaignId, codes: heldReasons.map((r) => r.code) });
    return { skipped: true, reason: "held_by_send_safety", codes: heldReasons.map((r) => r.code) };
  }

  const trackingId = existingDraft?.trackingId || crypto.randomUUID();
  const variantId = selectedVariant?.id;

  // Reuse existing draft row or create a new queued Email record
  const email = existingDraft
    ? await prisma.email.update({
        where: { id: existingDraft.id },
        data: { mailboxId: mailbox.id, subject, body, status: "queued", trackingId, ...(variantId ? { variantId } : {}) },
      })
    : await prisma.email.create({
        data: {
          leadId,
          campaignId,
          mailboxId: mailbox.id,
          subject,
          body,
          status: "queued",
          trackingId,
          ...(variantId ? { variantId } : {}),
        },
      });

  const resolvedTeamId = teamId || campaign.teamId;
  if (!resolvedTeamId) {
    throw new Error(`No teamId available for campaign ${campaignId}`);
  }

  const attachments = await prisma.campaignAttachment.findMany({
    where: { campaignId },
    select: { filename: true, mimeType: true, content: true },
  });

  // 4. Send via provider registered with MailProviderFactory
  const { MailProviderFactory } = await import("@/modules/email-campaigner/providers");
  const providerKey = mailbox.provider || "GOOGLE_WORKSPACE";
  const provider = MailProviderFactory.getProvider(providerKey);

  // Rewrite outbound links for click tracking, then append an open-tracking pixel and unsubscribe footer
  const linkTrackedBody = await rewriteLinksForTracking(body, {
    teamId: resolvedTeamId,
    emailId: email.id,
    mailboxId: mailbox.id,
    campaignId,
    leadId,
  });
  const finalHtml = appendUnsubscribeFooter(
    `${linkTrackedBody}${buildOpenPixelHtml(trackingId)}`,
    trackingId,
    postalAddress
  );

  let sendResult: any = null;
  try {
    sendResult = await provider.send(mailbox, {
      to: lead.email,
      from: mailbox.email,
      subject,
      html: finalHtml,
      text: stripHtmlTags(body),
      headers: {
        "Reply-To": mailbox.email,
        "X-Tracking-ID": email.trackingId || email.id,
        ...buildUnsubscribeHeaders(trackingId),
      },
      ...(attachments.length ? { attachments } : {}),
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
      provider: providerKey,
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

  if (variantId) {
    await prisma.campaignVariant.update({
      where: { id: variantId },
      data: { sentCount: { increment: 1 } },
    }).catch(() => undefined);
  }

  const leadStage = await advanceLeadAfterEmailSent(prisma, {
    leadId,
    teamId: resolvedTeamId,
    campaignId,
    emailId: sent.id,
  });

  logger.info(`[email_sending] Email sent successfully via ${providerKey}`, {
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
