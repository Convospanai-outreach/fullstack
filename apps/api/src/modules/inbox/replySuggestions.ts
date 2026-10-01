import { prisma } from "@/lib/db";
import type { ReplyOutcome } from "./actionInboxService";

// AI reply classifications are suggestions only. This is the single place that maps the
// classifier's vocabulary to the Action Inbox's manual outcomes; nothing here changes a lead.
// DNC suggests not_interested but is flagged so the UI can say "asked not to be contacted"
// and leave marking the lead DNC to the rep. OOO and QUESTION are labels with no outcome.
export function suggestedOutcomeFor(classification: string): { outcome: ReplyOutcome | null; askedNotToContact: boolean } {
    switch (classification) {
        case "INTERESTED":
            return { outcome: "interested", askedNotToContact: false };
        case "NOT_INTERESTED":
            return { outcome: "not_interested", askedNotToContact: false };
        case "DNC":
            return { outcome: "not_interested", askedNotToContact: true };
        default:
            return { outcome: null, askedNotToContact: false };
    }
}

export type ReplySuggestion = {
    classification: string;
    suggestedOutcome: ReplyOutcome | null;
    askedNotToContact: boolean;
    confidence: number;
    reasoning: string | null;
    suggestedReply: string | null;
};

// ReplyTracker.emailId holds the inbound Message id (see ReplyAnalyzerAgent). ReplyTracker has
// no team column, so every read is scoped through its lead's team.
export async function getSuggestionsForReplies(teamId: string, messageIds: string[]) {
    const suggestions = new Map<string, ReplySuggestion>();
    if (messageIds.length === 0) return suggestions;

    const rows = await prisma.replyTracker.findMany({
        where: { emailId: { in: messageIds }, lead: { teamId } },
        orderBy: { receivedAt: "asc" },
        select: { emailId: true, aiClassification: true, aiConfidence: true, aiReasoning: true, replyDraft: true },
    });
    for (const row of rows) {
        if (!row.emailId) continue;
        const { outcome, askedNotToContact } = suggestedOutcomeFor(row.aiClassification);
        suggestions.set(row.emailId, {
            classification: row.aiClassification,
            suggestedOutcome: outcome,
            askedNotToContact,
            confidence: row.aiConfidence,
            reasoning: row.aiReasoning,
            suggestedReply: row.replyDraft,
        });
    }
    return suggestions;
}
