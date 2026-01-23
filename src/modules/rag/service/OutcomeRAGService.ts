
import { prisma } from "@/lib/db";

export class OutcomeRAGService {
    /**
     * Task 1: Re-rank retrieval results based on outcome weights
     */
    static async rankResults(results: any[], _teamId: string) {
        // Fetch performance data for the retrieved items
        const itemIds = results.map(r => r.id);
        const performanceData = await prisma.knowledgePerformance.findMany({
            where: { knowledgeItemId: { in: itemIds } }
        });

        const performanceMap = new Map(performanceData.map(p => [p.knowledgeItemId, p]));

        // Re-ranking Logic
        return results.sort((a, b) => {
            const perfA = performanceMap.get(a.id);
            const perfB = performanceMap.get(b.id);

            const scoreA = this.calculateWeightedScore(a.similarity, perfA);
            const scoreB = this.calculateWeightedScore(b.similarity, perfB);

            return scoreB - scoreA;
        });
    }

    private static calculateWeightedScore(similarity: number, perf?: any): number {
        if (!perf) return similarity * 0.7; // Default weight for new content

        // Reward metric: weighted success frequency
        const successRate = perf.usageCount > 0
            ? (perf.replies * 1.0 + perf.clicks * 0.3) / perf.usageCount
            : 0;

        // Apply Time Decay (Task 1)
        // Decay by 50% every 30 days of inactivity
        const daysSinceSuccess = perf.lastSuccessAt
            ? (Date.now() - perf.lastSuccessAt.getTime()) / (1000 * 60 * 60 * 24)
            : 30;
        const decay = Math.pow(0.5, daysSinceSuccess / 30);

        return (similarity * 0.6) + (successRate * 0.4 * decay);
    }

    /**
     * Task 6: Causal Testing - Track experiment exposure
     */
    static async logExperimentExposure(variantId: string) {
        await prisma.experimentVariant.update({
            where: { id: variantId },
            data: { sampleCount: { increment: 1 } }
        });
    }
}
