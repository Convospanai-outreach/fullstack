import { prisma } from "@/lib/db";

export class LearningService {

    /**
     * Records user rating for an AI message.
     * If feedback is positive and has a comment, potentially save it as a memory (simplified logic).
     */
    static async recordFeedback(
        teamId: string,
        userId: string,
        messageId: string,
        rating: number,
        comment?: string
    ) {
        // 1. Save Feedback
        await prisma.agentFeedback.create({
            data: {
                messageId,
                userId,
                rating,
                comment
            }
        });

        // 2. Learning Logic (Simplified)
        // If rating is 5/5 and has a comment, store it as a preference.
        // In a real system, an LLM would analyze the "Diff" or the comment to extract the rule.
        if (rating === 5 && comment && comment.startsWith("Remember:")) {
            const rule = comment.replace("Remember:", "").trim();
            await prisma.agentMemory.create({
                data: {
                    teamId,
                    key: "user_preference",
                    value: rule,
                    confidence: 1.0
                }
            });
        }
    }

    /**
     * Retrieves relevant memories to inject into the AI context.
     * Currently returns all high-confidence memories for the team.
     */
    static async getMemories(teamId: string) {
        const memories = await prisma.agentMemory.findMany({
            where: { teamId, confidence: { gt: 0.5 } },
            orderBy: { createdAt: 'desc' },
            take: 5 // Limit context window usage
        });
        return memories.map(m => m.value);
    }
}
