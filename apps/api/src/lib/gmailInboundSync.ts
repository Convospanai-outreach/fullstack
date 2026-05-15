import { prisma } from "@/lib/db";
import { GmailMailboxService } from "@/lib/gmailMailboxService";
import { addSuppression, logEmailActivity } from "@/lib/emailTracking";
import { ReplyAnalyzerAgent } from "@/lib/ai/agents/ReplyAnalyzerAgent";
import { audit } from "@/lib/governance/audit";

function header(headers: any[] | undefined, name: string) {
    return headers?.find((h) => String(h.name || "").toLowerCase() === name.toLowerCase())?.value || "";
}

function decodeBody(data?: string | null) {
    if (!data) return "";
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function collectText(payload: any): string {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body?.data) return decodeBody(payload.body.data);
    if (payload.mimeType === "text/html" && payload.body?.data) {
        return decodeBody(payload.body.data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
    if (Array.isArray(payload.parts)) {
        return payload.parts.map(collectText).filter(Boolean).join("\n").trim();
    }
    return "";
}

function normalizeEmail(value: string) {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] || value).trim().toLowerCase();
}

function cleanMessageId(value: string) {
    return value.replace(/[<>]/g, "").trim();
}

async function matchOutboundEmail(teamId: string, gmailMessage: any, fromEmail: string) {
    const headers = gmailMessage.payload?.headers || [];
    const inReplyTo = cleanMessageId(header(headers, "In-Reply-To"));
    const references = header(headers, "References");
    const threadId = gmailMessage.threadId;

    const candidates: any[] = [];
    if (threadId) {
        const byThread = await (prisma as any).email.findFirst({
            where: { gmailThreadId: threadId, campaign: { teamId } },
            orderBy: { createdAt: "desc" },
        });
        if (byThread) candidates.push(byThread);
    }
    if (inReplyTo) {
        const byMessage = await (prisma as any).email.findFirst({
            where: { providerId: inReplyTo, campaign: { teamId } },
            orderBy: { createdAt: "desc" },
        });
        if (byMessage) candidates.push(byMessage);
    }
    if (references) {
        const referenceIds = references.split(/\s+/).map(cleanMessageId).filter(Boolean) as string[];
        if (referenceIds.length > 0) {
        const byReference = await (prisma as any).email.findFirst({
            where: {
                campaign: { teamId },
                OR: referenceIds.map((providerId) => ({ providerId })),
            },
            orderBy: { createdAt: "desc" },
        });
        if (byReference) candidates.push(byReference);
        }
    }

    const bySender = await (prisma as any).email.findFirst({
        where: { lead: { email: fromEmail }, campaign: { teamId } },
        orderBy: { createdAt: "desc" },
    });
    if (bySender) candidates.push(bySender);

    return candidates[0] || null;
}

export async function syncGmailMailbox(mailboxId: string, requestedHistoryId?: string | null) {
    const mailbox = await (prisma as any).connectedMailbox.findUnique({ where: { id: mailboxId } });
    if (!mailbox) throw new Error("Mailbox not found.");

    const gmail = await GmailMailboxService.getGmail(mailbox);
    const startHistoryId = mailbox.gmailHistoryId || requestedHistoryId;
    if (!startHistoryId) {
        await (prisma as any).connectedMailbox.update({
            where: { id: mailbox.id },
            data: { lastSyncAt: new Date(), lastError: "Missing Gmail history cursor; reconnect mailbox to initialize watch." },
        });
        return { processed: 0, reason: "missing_history_id" };
    }

    const processedIds = new Set<string>();
    let pageToken: string | undefined;
    let latestHistoryId = startHistoryId;
    let processed = 0;

    do {
        const history = await gmail.users.history.list({
            userId: "me",
            startHistoryId,
            historyTypes: ["messageAdded"],
            pageToken,
        });
        latestHistoryId = history.data.historyId || latestHistoryId;
        pageToken = history.data.nextPageToken || undefined;

        for (const item of history.data.history || []) {
            for (const added of item.messagesAdded || []) {
                const messageId = added.message?.id;
                if (!messageId || processedIds.has(messageId)) continue;
                processedIds.add(messageId);

                const full = await gmail.users.messages.get({
                    userId: "me",
                    id: messageId,
                    format: "full",
                });
                const msg = full.data;
                const headers = msg.payload?.headers || [];
                const fromEmail = normalizeEmail(header(headers, "From"));
                if (!fromEmail || fromEmail === mailbox.emailAddress.toLowerCase()) continue;

                const outbound = await matchOutboundEmail(mailbox.teamId, msg, fromEmail);
                if (!outbound) continue;

                const subject = header(headers, "Subject") || "(No subject)";
                const body = collectText(msg.payload) || msg.snippet || "";
                const existing = await (prisma as any).emailActivityLog.findFirst({
                    where: { teamId: mailbox.teamId, messageId: msg.id, eventType: "REPLIED" },
                    select: { id: true },
                });
                if (existing) continue;

                await prisma.lead.update({
                    where: { id: outbound.leadId },
                    data: { status: "replied" },
                });
                await prisma.message.create({
                    data: {
                        leadId: outbound.leadId,
                        content: body,
                        direction: "INBOUND",
                        platform: "EMAIL",
                        sender: fromEmail,
                        status: "received",
                        isRead: false,
                    },
                });

                const analysis = await ReplyAnalyzerAgent.analyzeAndTrack(subject, body, outbound.leadId, fromEmail, outbound.id);
                if (analysis.classification === "DNC") {
                    await addSuppression(mailbox.teamId, fromEmail, "DNC", "GMAIL_REPLY", { messageId: msg.id });
                }

                await prisma.campaignVariant.updateMany({
                    where: { campaignId: outbound.campaignId },
                    data: { replyCount: { increment: 1 } },
                });
                await logEmailActivity({
                    teamId: mailbox.teamId,
                    emailId: outbound.id,
                    campaignId: outbound.campaignId,
                    leadId: outbound.leadId,
                    messageId: msg.id || undefined,
                    eventType: "REPLIED",
                    metadata: {
                        provider: "GOOGLE",
                        threadId: msg.threadId || null,
                        classification: analysis.classification,
                        confidence: analysis.confidence,
                    },
                });
                processed += 1;
            }
        }
    } while (pageToken);

    await (prisma as any).connectedMailbox.update({
        where: { id: mailbox.id },
        data: {
            gmailHistoryId: latestHistoryId,
            lastSyncAt: new Date(),
            lastError: null,
        },
    });
    await audit({
        actorId: "system",
        orgId: mailbox.teamId,
        action: "GMAIL_REPLY_SYNCED",
        entity: "ConnectedMailbox",
        entityId: mailbox.id,
        metadata: { processed },
    });

    return { processed, historyId: latestHistoryId };
}
