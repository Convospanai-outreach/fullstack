import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { JobPayload } from "@/lib/queue";

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

  // 4. Record email row (actual send delegated to Gmail API service)
  // TODO: Call GmailSendService.send() here once integrated
  const email = await prisma.email.create({
    data: {
      leadId,
      campaignId,
      mailboxId: mailbox.id,
      subject: `Follow-up from ${campaign.name}`,
      body: "",         // populated by AI generation upstream
      status: "queued",
    }
  });

  logger.info("[email_sending] Email record created, pending send", { emailId: email.id, leadId });
  return { emailId: email.id, status: "queued" };
}
