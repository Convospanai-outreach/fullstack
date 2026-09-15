// IMAP reply sync for SMTP-provider ConnectedMailbox rows. Mirrors the inbound-reply
// matching pattern in googleMailboxService.ts's createInboundCampaignEvent (match via
// In-Reply-To/References against a sent Email row scoped to this mailbox, dedupe via the
// EmailEvent unique constraint, create a Message row, advance the lead). Gmail's sync also
// uses a mailbox lease/cursor system tied to its history-API cursor model - that's not
// needed here: only one process (WorkerManager, on the dedicated api-worker VM) ever runs
// this sync, so the EmailEvent @@unique([teamId, provider, providerMessageId, type])
// constraint alone is enough to make a re-run idempotent.
import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/security/credentialVault";
import { advanceLeadAfterReply } from "@/lib/crm/leadStageTransitions";

const FIRST_SYNC_LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, per task spec

export type ImapMailboxSyncResult = {
    mailboxId: string;
    email: string;
    synced: number;
    replies: number;
    bounces: number;
    error?: string;
};

function extractEmailAddress(value?: string): string {
    if (!value) return "";
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
}

function uniqueValues(values: Array<string | undefined | null>): string[] {
    return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function isBounceMessage(from: string, subject: string): boolean {
    return /mailer-daemon|postmaster/i.test(from) || /delivery status notification|undeliver|delivery failed|returned mail/i.test(subject);
}

function isEmailEventUniqueDuplicate(error: any): boolean {
    if (error?.code !== "P2002") return false;
    const expected = ["teamId", "provider", "providerMessageId", "type"];
    const target = error.meta?.target;
    if (Array.isArray(target)) {
        return target.length === expected.length && expected.every((field) => target.includes(field));
    }
    if (typeof target !== "string") return false;
    const normalized = target.toLowerCase().replace(/[^a-z0-9]/g, "");
    return expected.every((field) => normalized.includes(field.toLowerCase()));
}

async function processParsedMessage(input: {
    teamId: string;
    mailbox: { id: string; email: string };
    parsed: ParsedMail;
}): Promise<"reply" | "bounce" | "ignored" | "duplicate"> {
    const { teamId, mailbox, parsed } = input;

    const providerMessageId = parsed.messageId;
    if (!providerMessageId) return "ignored";

    const inReplyTo = Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] : parsed.inReplyTo;
    const references = Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [];
    const providerIds = uniqueValues([inReplyTo, ...references]);
    if (providerIds.length === 0) return "ignored";

    const from = parsed.from?.text || "";
    const subject = parsed.subject || "";
    const fromEmail = extractEmailAddress(from);
    if (!fromEmail || fromEmail === mailbox.email.toLowerCase()) return "ignored";

    const isBounce = isBounceMessage(from, subject);
    const type = isBounce ? "BOUNCE" : "REPLY_RECEIVED";

    try {
        return await prisma.$transaction(async (tx) => {
            const matchedEmail = await tx.email.findFirst({
                where: {
                    mailboxId: mailbox.id,
                    campaign: { teamId },
                    OR: providerIds.map((providerId) => ({ providerId })),
                },
                select: { id: true, leadId: true, campaignId: true },
            });
            if (!matchedEmail) return "ignored" as const;

            const existingEvent = await tx.emailEvent.findFirst({
                where: { teamId, provider: "SMTP", providerMessageId, type },
                select: { id: true },
            });
            if (existingEvent) return "duplicate" as const;

            const emailEvent = await tx.emailEvent.create({
                data: {
                    teamId,
                    emailId: matchedEmail.id,
                    mailboxId: mailbox.id,
                    leadId: matchedEmail.leadId,
                    campaignId: matchedEmail.campaignId,
                    type,
                    provider: "SMTP",
                    providerMessageId,
                    payload: { from, subject },
                },
            });

            if (isBounce) {
                const lead = await tx.lead.findUnique({
                    where: { id: matchedEmail.leadId },
                    select: { email: true },
                });
                await tx.email.update({
                    where: { id: matchedEmail.id },
                    data: { bouncedAt: new Date(), status: "bounced" },
                });
                await tx.lead.update({
                    where: { id: matchedEmail.leadId },
                    data: { status: "STOPPED", updatedAt: new Date() },
                });
                await tx.connectedMailbox.update({
                    where: { id: mailbox.id },
                    data: { bounceCount: { increment: 1 } },
                });
                if (lead?.email) {
                    await tx.suppressionEntry.upsert({
                        where: { teamId_email: { teamId, email: lead.email.toLowerCase() } },
                        create: { teamId, email: lead.email.toLowerCase(), reason: "BOUNCE", source: "IMAP_SYNC", leadId: matchedEmail.leadId },
                        update: { reason: "BOUNCE", source: "IMAP_SYNC", leadId: matchedEmail.leadId },
                    });
                }
                await tx.emailEvent.update({ where: { id: emailEvent.id }, data: { processedAt: new Date() } });
                return "bounce" as const;
            }

            await tx.message.create({
                data: {
                    leadId: matchedEmail.leadId,
                    content: parsed.text || parsed.html || subject || "Reply detected",
                    direction: "INBOUND",
                    platform: "EMAIL",
                    sender: from,
                    status: "received",
                    isRead: false,
                    emailEventId: emailEvent.id,
                },
            });
            await tx.email.update({
                where: { id: matchedEmail.id },
                data: { repliedAt: new Date(), status: "replied" },
            });
            await advanceLeadAfterReply(tx as any, { leadId: matchedEmail.leadId, teamId });
            await tx.connectedMailbox.update({
                where: { id: mailbox.id },
                data: { replyCount: { increment: 1 } },
            });
            await tx.emailEvent.update({ where: { id: emailEvent.id }, data: { processedAt: new Date() } });
            return "reply" as const;
        });
    } catch (error: any) {
        if (isEmailEventUniqueDuplicate(error)) return "duplicate";
        throw error;
    }
}

function buildImapConfig(mailbox: any, password: string) {
    const metadata = (mailbox.metadata as any) || {};
    return {
        host: metadata.imapHost || metadata.host,
        port: metadata.imapPort ?? 993,
        secure: metadata.imapSecure ?? true,
        auth: { user: mailbox.email, pass: password },
        logger: false as const,
    };
}

export async function syncImapMailbox(mailbox: any): Promise<ImapMailboxSyncResult> {
    const result: ImapMailboxSyncResult = {
        mailboxId: mailbox.id,
        email: mailbox.email,
        synced: 0,
        replies: 0,
        bounces: 0,
    };

    let client: ImapFlow | undefined;
    try {
        const password = await decryptCredential(mailbox.encryptedAccessToken as any);
        const metadata = (mailbox.metadata as any) || {};
        if (!password || !(metadata.imapHost || metadata.host)) {
            result.error = "IMAP_CREDENTIALS_UNAVAILABLE";
            return result;
        }

        client = new ImapFlow(buildImapConfig(mailbox, password));
        await client.connect();

        const since = mailbox.lastSyncAt ?? new Date(Date.now() - FIRST_SYNC_LOOKBACK_MS);
        const lock = await client.getMailboxLock("INBOX");
        try {
            for await (const message of client.fetch({ since }, { source: true })) {
                if (!message.source) continue;
                try {
                    const parsed = await simpleParser(message.source);
                    const outcome = await processParsedMessage({ teamId: mailbox.teamId, mailbox, parsed });
                    result.synced += 1;
                    if (outcome === "reply") result.replies += 1;
                    if (outcome === "bounce") result.bounces += 1;
                } catch (messageError: any) {
                    console.error(`[ImapReplySync] Failed to process a message for mailbox ${mailbox.id}: ${messageError?.message ?? messageError}`);
                }
            }
        } finally {
            lock.release();
        }
    } catch (error: any) {
        result.error = error?.message ?? String(error);
        console.error(`[ImapReplySync] Mailbox ${mailbox.id} sync failed: ${result.error}`);
    } finally {
        if (client) {
            try {
                await client.logout();
            } catch {
                // Connection may already be closed after a failed connect/fetch - not actionable.
            }
        }
        await prisma.connectedMailbox.update({
            where: { id: mailbox.id },
            data: { lastSyncAt: new Date() },
        }).catch(() => undefined);
    }

    return result;
}

export async function syncDueImapMailboxes(): Promise<ImapMailboxSyncResult[]> {
    const mailboxes = await prisma.connectedMailbox.findMany({
        where: { provider: "SMTP", status: "CONNECTED" },
    });

    const results: ImapMailboxSyncResult[] = [];
    for (const mailbox of mailboxes) {
        results.push(await syncImapMailbox(mailbox));
    }
    return results;
}
