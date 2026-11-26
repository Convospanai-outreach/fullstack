import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { toPlainText } from "./actionInboxService";
import { promoteLeadOnJudgedReply } from "./replyPromotion";
import { enforceOptOutOnJudgedReply } from "./replyOptOut";
import { getDripPlaybook } from "@/modules/playbooks/dripPlaybooks";

// Reply classification is a best-effort suggestion for the Action Inbox, run as a queued job
// so it can never slow down or fail inbound-reply ingestion. Two exceptions: a reply judged
// interested moves the lead to HOT and into the caller queue (see replyPromotion), and a reply
// judged DNC opts the lead out (see replyOptOut; its failure fails the job so it is retried).

const MAX_CLASSIFIED_CHARS = 4000;
const REPLY_FOLLOW_UP = {
    INTERESTED: { title: "Follow up with an interested contact", delayDays: 0, priority: "HIGH" },
    QUESTION: { title: "Review and answer a contact's question", delayDays: 0, priority: "HIGH" },
    OOO: { title: "Review an out-of-office reply", delayDays: 3, priority: "MEDIUM" },
} as const;

async function scheduleReplyFollowUp(input: { teamId: string; leadId: string; messageId: string; ownerId: string; receivedAt: Date; classification: string; confidence: number }) {
    const action = REPLY_FOLLOW_UP[input.classification as keyof typeof REPLY_FOLLOW_UP];
    if (!action || !(input.confidence >= 0.7)) return;
    const owner = await prisma.teamMember.findFirst({ where: { teamId: input.teamId, userId: input.ownerId, status: "active" }, select: { id: true } });
    if (!owner) return;
    const id = `reply-follow-up:${input.messageId}`;
    await prisma.task.upsert({
        where: { id },
        update: {},
        create: {
            id, teamId: input.teamId, leadId: input.leadId, userId: input.ownerId,
            title: action.title, priority: action.priority,
            description: `Review this reply in the Action Inbox: /inbox?reply=${encodeURIComponent(input.messageId)}`,
            dueDate: new Date(input.receivedAt.getTime() + action.delayDays * 86_400_000),
        },
    });
}

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
            createdAt: true,
            content: true,
            lead: { select: { email: true } },
            emailEvent: { select: {
                teamId: true,
                email: { select: { subject: true, mailboxId: true, campaignId: true, campaign: { select: { teamId: true, ownerId: true, aiConfig: true } } } },
            } },
        },
    });
    if (!message) return { skipped: "not_found" as const };

    const campaign = message.emailEvent?.email?.campaign;
    const config = campaign?.aiConfig as { dripPlaybook?: { kind?: unknown; replyFollowUp?: unknown } } | null | undefined;
    const kind = config?.dripPlaybook?.kind;
    const playbook = message.emailEvent?.teamId === teamId && campaign?.teamId === teamId && typeof kind === "string"
        ? getDripPlaybook(kind)
        : undefined;
    const followUp = async (classification: string, confidence: number, draftResponse?: string | null) => {
        const email = message.emailEvent?.email;
        if (playbook && campaign && email?.mailboxId) {
            const { seedReplySubsequence, reactToReplyClassification } = await import("./replySubsequenceService");
            await reactToReplyClassification({ teamId, leadId: message.leadId }, message.id, classification, confidence);
            if (await seedReplySubsequence({ teamId, leadId: message.leadId, messageId: message.id, receivedAt: message.createdAt,
                campaignId: email.campaignId, mailboxId: email.mailboxId, ownerId: campaign.ownerId,
                aiConfig: campaign.aiConfig, classification, confidence, ...(draftResponse ? { draftResponse } : {}) })) return;
        }
        if (!playbook || config?.dripPlaybook?.replyFollowUp !== true || !campaign?.ownerId) return;
        await scheduleReplyFollowUp({ teamId, leadId: message.leadId, messageId: message.id, ownerId: campaign.ownerId,
            receivedAt: message.createdAt, classification, confidence });
    };

    const existing = await prisma.replyTracker.findFirst({
        where: { emailId: message.id, lead: { teamId } },
        select: { id: true, aiClassification: true, aiConfidence: true, replyDraft: true },
    });
    if (existing) {
        // A retry after the reply was stored but the promotion or opt-out failed: both are idempotent, so try again.
        await enforceOptOutOnJudgedReply({ leadId: message.leadId, classification: existing.aiClassification, confidence: existing.aiConfidence, channel: "EMAIL" });
        await promoteLeadOnJudgedReply({ leadId: message.leadId, teamId, classification: existing.aiClassification, confidence: existing.aiConfidence });
        await followUp(existing.aiClassification, existing.aiConfidence, existing.replyDraft);
        return { skipped: "already_classified" as const };
    }

    const { ReplyAnalyzerAgent } = await import("@/lib/ai/agents/ReplyAnalyzerAgent");
    const result = await ReplyAnalyzerAgent.analyzeAndTrack(
        message.emailEvent?.email?.subject ?? "",
        toPlainText(message.content).slice(0, MAX_CLASSIFIED_CHARS),
        message.leadId,
        message.lead.email ?? "",
        message.id,
        teamId,
        playbook,
    );
    await enforceOptOutOnJudgedReply({ leadId: message.leadId, classification: result.classification, confidence: result.confidence, channel: "EMAIL" });
    await promoteLeadOnJudgedReply({ leadId: message.leadId, teamId, classification: result.classification, confidence: result.confidence });
    await followUp(result.classification, result.confidence, result.draftResponse);
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
        select: { id: true, leadId: true, content: true, platform: true, lead: { select: { email: true } }, emailEvent: { select: { email: { select: { subject: true } } } } },
    });
    if (!message) return;
    if (message.platform === "EMAIL") {
        const { reactToReplyClassification } = await import("./replySubsequenceService");
        await reactToReplyClassification({ teamId, leadId: message.leadId }, message.id, "UNSURE", 0);
    }
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
