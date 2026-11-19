import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { promoteLeadOnJudgedReply } from "@/modules/inbox/replyPromotion";
import { enforceOptOutOnJudgedReply } from "@/modules/inbox/replyOptOut";

// A WhatsApp reply is judged like an email reply: only one that shows buying interest moves the lead to HOT,
// and one that asks not to be contacted opts the lead out (its failure fails the job so it is retried).
// WhatsApp messages live in their own table and are not in the Action Inbox, so this job stores nothing: it
// classifies the text and, when it qualifies, promotes the lead. Run as a queued job so the webhook never
// waits on the model.

const MAX_CLASSIFIED_CHARS = 2000;

type InboundWhatsAppMessage = { id: string; leadId: string };

// Called (void) from the WhatsApp webhook after the message is stored. Swallows its own errors: a queue
// failure must not change what the webhook returns.
export async function enqueueWhatsAppReplyClassification(message: InboundWhatsAppMessage) {
    try {
        const lead = await prisma.lead.findUnique({ where: { id: message.leadId }, select: { teamId: true } });
        if (!lead?.teamId) return;

        const { JobQueue } = await import("@/lib/queue");
        // One job per inbound message: the idempotency key makes a Meta re-delivery a no-op.
        await JobQueue.enqueue(
            "whatsapp_reply_classification",
            { messageId: message.id, teamId: lead.teamId },
            { teamId: lead.teamId, idempotencyKey: `whatsapp_reply_classification_${message.id}` }
        );
    } catch (error) {
        logger.warn("[WhatsAppReply] Could not enqueue classification", { messageId: message.id, error: error instanceof Error ? error.message : String(error) });
    }
}

// Job handler. A message outside `teamId` (or not inbound) is never classified.
export async function classifyWhatsAppReply(teamId: string, messageId: string) {
    const message = await prisma.whatsAppMessage.findFirst({
        where: { id: messageId, direction: "INBOUND", lead: { teamId } },
        select: { id: true, leadId: true, body: true, lead: { select: { fullName: true, company: true } } },
    });
    if (!message) return { skipped: "not_found" as const };

    // The text goes to TypeSafe, so mask it exactly as the email reply analyzer does: patterns first, then the
    // lead's own name and company (pattern masking cannot see names).
    const { SovereignFirewall } = await import("@/lib/ai/SovereignFirewall");
    const { safeContext: masked, tokenMap } = await SovereignFirewall.mask(message.body.slice(0, MAX_CLASSIFIED_CHARS), "GLOBAL", undefined, { alwaysMask: true });
    const safeBody = SovereignFirewall.maskKnownNames(masked, { person: message.lead.fullName, company: message.lead.company }, tokenMap).safeContext;

    const { classifyReply } = await import("@/lib/ai/jev");
    const { classification, confidence } = await classifyReply({ subject: "", body: safeBody }, teamId);

    await enforceOptOutOnJudgedReply({ leadId: message.leadId, classification, confidence, channel: "WHATSAPP" });
    await promoteLeadOnJudgedReply({ leadId: message.leadId, teamId, classification, confidence });
    return { classification };
}
