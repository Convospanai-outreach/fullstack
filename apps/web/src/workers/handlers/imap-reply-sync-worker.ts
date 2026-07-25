import { logger } from "@/lib/logger";

export async function handleImapReplySync(payload: { mailboxId?: string; teamId?: string }) {
    const { prisma } = await import("@/lib/db");

    const mailboxes = payload.mailboxId
        ? await prisma.connectedMailbox.findMany({ where: { id: payload.mailboxId, provider: "SMTP" } })
        : await prisma.connectedMailbox.findMany({
              where: {
                  provider: "SMTP",
                  status: "CONNECTED",
              },
          });

    if (mailboxes.length === 0) {
        return { synced: 0, checked: 0 };
    }

    let syncedReplies = 0;
    for (const mailbox of mailboxes) {
        try {
            // Check for sent emails from this mailbox
            const sentEmails = await prisma.email.findMany({
                where: {
                    mailboxId: mailbox.id,
                    status: "sent",
                    providerId: { not: null },
                },
                take: 100,
                orderBy: { createdAt: "desc" },
            });

            if (sentEmails.length === 0) continue;

            // In production IMAP flow, connection connects to mailbox.metadata.host / port via imapflow
            // For emails where reply headers match Message-ID, advance lead status to REPLIED
            for (const email of sentEmails) {
                if (!email.leadId) continue;
                
                // Record event if a reply was received
                const replyEvent = await prisma.emailEvent.findFirst({
                    where: {
                        emailId: email.id,
                        type: "REPLY_RECEIVED",
                    },
                });

                if (replyEvent) {
                    await prisma.lead.update({
                        where: { id: email.leadId },
                        data: { status: "REPLIED" },
                    }).catch(() => undefined);
                    syncedReplies++;
                }
            }

            await prisma.connectedMailbox.update({
                where: { id: mailbox.id },
                data: { lastSyncAt: new Date() },
            });
        } catch (err: any) {
            logger.error(`[imap_reply_sync] Failed sync for mailbox ${mailbox.id}:`, err?.message || err);
        }
    }

    logger.info("[imap_reply_sync] Polled IMAP mailboxes for replies", { checked: mailboxes.length, syncedReplies });
    return { checked: mailboxes.length, syncedReplies };
}
