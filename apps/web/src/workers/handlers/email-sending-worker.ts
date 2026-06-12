import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { JobPayload } from "@/lib/queue";
import { advanceLeadAfterEmailSent } from "@/lib/crm/leadStageTransitions";
import { sendViaGmailMailbox } from "@/modules/email-campaigner/service/googleMailboxService";

export async function handleEmailSending(payload: JobPayload) {
  const { leadId, campaignId, teamId, mailboxId } = payload;

  if (!leadId || !campaignId) {
    throw new Error("email_sending: leadId and campaignId are required");
  }

  // 1. Load lead + campaign
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.email) throw new Error(`Lead ${leadId} has no email address`);

  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

  // 2. Check suppression list
  if (teamId) {
    const suppressed = await prisma.suppressionEntry.findUnique({
      where: { teamId_email: { teamId, email: lead.email } }
    });
    if (suppressed) {
      logger.warn("[email_sending] Lead on suppression list, skipping", { leadId, email: lead.email });
      return { skipped: true, reason: "suppressed" };
    }
  }

  // 3. Find active mailbox for team
  const mailbox = mailboxId
    ? await prisma.connectedMailbox.findUnique({ where: { id: mailboxId } })
    : await prisma.connectedMailbox.findFirst({
        where: { teamId: teamId as string, status: "CONNECTED" }
      });

  if (!mailbox) {
    throw new Error(`No connected mailbox available for team ${teamId}`);
  }

  const payloadSubject = payload["subject"];
  const payloadBody = payload["body"];
  const subject = typeof payloadSubject === "string" && payloadSubject.trim()
    ? payloadSubject.trim()
    : `Follow-up from ${campaign.name}`;
  const body = typeof payloadBody === "string" ? payloadBody : "";

  // 4. Record email row, then send via the connected Google mailbox.
  const email = await prisma.email.create({
    data: {
      leadId,
      campaignId,
      mailboxId: mailbox.id,
      subject,
      body,
      status: "queued",
    }
  });

  const resolvedTeamId = teamId || campaign.teamId;
  if (!resolvedTeamId) {
    throw new Error(`No teamId available for campaign ${campaignId}`);
  }

  const result = await sendViaGmailMailbox({
    teamId: resolvedTeamId,
    mailboxId: mailbox.id,
    to: lead.email,
    subject,
    html: body,
  });

  if (!result.success) {
    await prisma.email.update({
      where: { id: email.id },
      data: { status: "failed" },
    });
    throw new Error(result.error || "Gmail send failed.");
  }

  const sent = await prisma.email.update({
    where: { id: email.id },
    data: {
      status: "sent",
      ...(result.messageId ? { providerId: result.messageId } : {}),
      ...(result.threadId ? { threadId: result.threadId } : {}),
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
        sentAt: sentAt.toISOString()
      }
    }
  });

  const leadStage = await advanceLeadAfterEmailSent(prisma, {
    leadId,
    teamId: resolvedTeamId,
    campaignId,
    emailId: sent.id
  });

  logger.info("[email_sending] Email sent", { emailId: sent.id, leadId, mailboxId: mailbox.id });
  return {
    emailId: sent.id,
    status: "sent",
    providerId: sent.providerId,
    threadId: sent.threadId,
    leadStageChanged: leadStage.leadStageChanged,
    leadStatus: leadStage.leadStatus,
    pipelineState: leadStage.pipelineState
  };
}
