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
                comment: comment ?? null
            }
        });

        // 2. Learning Logic (Advanced)
        // Extract rules from high-rating comments or negative rating feedback.
        if (rating === 5 && comment) {
            await prisma.agentMemory.create({
                data: {
                    teamId,
                    key: "positive_preference",
                    value: comment,
                    confidence: 1.0
                }
            });
        } else if (rating === 1 && comment) {
            await prisma.agentMemory.create({
                data: {
                    teamId,
                    key: "negative_preference",
                    value: `Avoid: ${comment}`,
                    confidence: 0.9
                }
            });
        }
    }

    /**
     * Retrieves relevant memories with weighted decay for recency.
     */
    static async getMemories(teamId: string) {
        const memories = await prisma.agentMemory.findMany({
            where: { teamId },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        // Decay logic: older memories have lower confidence over time (simulated here)
        return memories
            .filter(m => {
                const ageInDays = (Date.now() - new Date(m.createdAt).getTime()) / (1000 * 60 * 60 * 24);
                const decay = Math.pow(0.9, ageInDays); // 10% decay per day
                return m.confidence * decay > 0.3;
            })
            .map(m => m.value);
    }
}
