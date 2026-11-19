import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toPlainText } from "./actionInboxService";
import { promoteLeadOnJudgedReply } from "./replyPromotion";
import { enforceOptOutOnJudgedReply } from "./replyOptOut";

// Reply classification is a best-effort suggestion for the Action Inbox, run as a queued job
// so it can never slow down or fail inbound-reply ingestion. Two exceptions: a reply judged
// interested moves the lead to HOT and into the caller queue (see replyPromotion), and a reply
// judged DNC opts the lead out (see replyOptOut; its failure fails the job so it is retried).

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
        select: { id: true, aiClassification: true, aiConfidence: true },
    });
    if (existing) {
        // A retry after the reply was stored but the promotion or opt-out failed: both are idempotent, so try again.
        await enforceOptOutOnJudgedReply({ leadId: message.leadId, classification: existing.aiClassification, confidence: existing.aiConfidence, channel: "EMAIL" });
        await promoteLeadOnJudgedReply({ leadId: message.leadId, teamId, classification: existing.aiClassification, confidence: existing.aiConfidence });
        return { skipped: "already_classified" as const };
    }

    const { ReplyAnalyzerAgent } = await import("@/lib/ai/agents/ReplyAnalyzerAgent");
    const result = await ReplyAnalyzerAgent.analyzeAndTrack(
        message.emailEvent?.email?.subject ?? "",
        toPlainText(message.content).slice(0, MAX_CLASSIFIED_CHARS),
        message.leadId,
        message.lead.email ?? "",
        message.id,
        teamId
    );
    await enforceOptOutOnJudgedReply({ leadId: message.leadId, classification: result.classification, confidence: result.confidence, channel: "EMAIL" });
    await promoteLeadOnJudgedReply({ leadId: message.leadId, teamId, classification: result.classification, confidence: result.confidence });
    return { classification: result.classification };
}

// Runs the classification job. When it fails for good (the last attempt, or an error retrying
// cannot fix) the reply gets an UNSURE suggestion so a rep reads it themselves, then the original
// error is rethrown so the job still shows as failed. Earlier attempts just retry.
export async function classifyInboundReplyOrFlag(teamId: string, messageId: string, jobId: string) {
    try {
        return await classifyInboundReply(teamId, messageId);
    } catch (error) {
        try {
            const job = await prisma.job.findUnique({ where: { id: jobId }, select: { attempts: true, maxAttempts: true } });
            const retryable = !(error instanceof Error && /insufficient credits/i.test(error.message));
            if (!retryable || (job && job.attempts >= job.maxAttempts)) await flagUnreadableReply(teamId, messageId);
        } catch (flagError) {
            logger.warn("[ReplyClassification] Could not flag an unreadable reply", { messageId, error: flagError instanceof Error ? flagError.message : String(flagError) });
        }
        throw error;
    }
}

// Stores one UNSURE suggestion (no draft, no confidence): the Action Inbox shows it as "could not
// be read, please check". It never changes the lead.
async function flagUnreadableReply(teamId: string, messageId: string) {
    const message = await prisma.message.findFirst({
        where: { id: messageId, direction: "INBOUND", lead: { teamId } },
        select: { id: true, leadId: true, content: true, lead: { select: { email: true } }, emailEvent: { select: { email: { select: { subject: true } } } } },
    });
    if (!message) return;
    const existing = await prisma.replyTracker.findFirst({ where: { emailId: message.id, lead: { teamId } }, select: { id: true } });
    if (existing) return;
    await prisma.replyTracker.create({
        data: {
            leadId: message.leadId,
            emailId: message.id,
            senderEmail: message.lead.email ?? "",
            subject: message.emailEvent?.email?.subject ?? "",
            body: toPlainText(message.content).slice(0, MAX_CLASSIFIED_CHARS),
            aiClassification: "UNSURE",
            aiConfidence: 0,
            aiReasoning: "This reply could not be read automatically. Please read it yourself.",
            status: "PENDING_REVIEW",
            replyDraft: null,
        },
    });
}
