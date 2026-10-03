import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toPlainText } from "./actionInboxService";

// Reply classification is a best-effort suggestion for the Action Inbox, run as a queued job
// so it can never slow down or fail inbound-reply ingestion.

const MAX_CLASSIFIED_CHARS = 4000;

type InboundReply = { id: string; leadId: string };

// Called (void) from every inbound-reply ingestion path via onInboundReply. Swallows its own
// errors: a queue failure must not change what ingestion returns.
export async function enqueueReplyClassification(message: InboundReply) {
    try {
        const lead = await prisma.lead.findUnique({ where: { id: message.leadId }, select: { teamId: true } });
        if (!lead?.teamId) return;

        const { JobQueue } = await import("@/lib/queue");
        // One job per inbound message: the idempotency key makes re-delivery a no-op.
        await JobQueue.enqueue(
            "reply_classification",
            { messageId: message.id, teamId: lead.teamId },
            { teamId: lead.teamId, idempotencyKey: `reply_classification_${message.id}` }
        );
    } catch (error) {
        logger.warn("[ReplyClassification] Could not enqueue classification", { messageId: message.id, error: error instanceof Error ? error.message : String(error) });
    }
}

// Job handler. A message outside `teamId` (or not an inbound reply) is never classified.
export async function classifyInboundReply(teamId: string, messageId: string) {
    const message = await prisma.message.findFirst({
        where: { id: messageId, direction: "INBOUND", lead: { teamId } },
        select: {
            id: true,
            leadId: true,
            content: true,
            lead: { select: { email: true } },
            emailEvent: { select: { email: { select: { subject: true } } } },
        },
    });
    if (!message) return { skipped: "not_found" as const };

    const existing = await prisma.replyTracker.findFirst({
        where: { emailId: message.id, lead: { teamId } },
        select: { id: true },
    });
    if (existing) return { skipped: "already_classified" as const };

    const { ReplyAnalyzerAgent } = await import("@/lib/ai/agents/ReplyAnalyzerAgent");
    const result = await ReplyAnalyzerAgent.analyzeAndTrack(
        message.emailEvent?.email?.subject ?? "",
        toPlainText(message.content).slice(0, MAX_CLASSIFIED_CHARS),
        message.leadId,
        message.lead.email ?? "",
        message.id,
        teamId
    );
    return { classification: result.classification };
}
