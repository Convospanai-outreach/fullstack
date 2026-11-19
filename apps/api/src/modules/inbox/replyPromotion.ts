import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { advanceLeadAfterInterestedReply } from "@/lib/crm/leadStageTransitions";

// A reply is a fact; whether it shows buying interest is a judgment. The stage only moves to HOT once a
// reply has been classified as interested (or as a question about the offer) with confidence, and the lead
// then goes to the human caller queue. Every other classification stays a suggestion for a rep (the Action
// Inbox): not-interested and do-not-contact replies are never acted on automatically.

// Replies that show buying interest.
const PROMOTING_CLASSIFICATIONS = new Set(["INTERESTED", "QUESTION"]);
// Same bar Jev's own yes/no answers use (NOUL_YES in lib/ai/jev, not imported here to keep the SDK out of this module).
export const PROMOTION_MIN_CONFIDENCE = 0.7;

/**
 * Moves the lead to HOT and queues it for a caller when the judged reply shows buying interest.
 * Idempotent, so a retried job can safely call it again. Never throws: the classification is already
 * stored, and a failed promotion must not fail (and so re-run) the job that stored it.
 * Returns true when the reply qualified for promotion.
 */
export async function promoteLeadOnJudgedReply(params: { leadId: string; teamId: string; classification: string; confidence: number }): Promise<boolean> {
    // Written as "not >=" so a missing or NaN confidence fails closed instead of passing a "<" check.
    if (!PROMOTING_CLASSIFICATIONS.has(params.classification) || !(params.confidence >= PROMOTION_MIN_CONFIDENCE)) return false;

    try {
        const result = await advanceLeadAfterInterestedReply(prisma, { leadId: params.leadId, teamId: params.teamId });
        // Only a lead that is HOT goes to the caller queue; a lead already further along (meeting, closed) does not.
        if (result.lead?.pipelineState === "HOT") {
            const { CallerService } = await import("@/modules/caller/CallerService");
            await CallerService.ensureQueueEntry(params.leadId, "HOT");
        }
    } catch (error) {
        logger.warn("[ReplyPromotion] Could not promote the lead after an interested reply", {
            leadId: params.leadId,
            error: error instanceof Error ? error.message : String(error),
        });
    }
    return true;
}
