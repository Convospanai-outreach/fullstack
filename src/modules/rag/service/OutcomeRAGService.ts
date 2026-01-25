
import { prisma } from "@/lib/db";

export class OutcomeRAGService {
    /**
     * Task 1: Re-rank retrieval results based on outcome weights
     */
    static rankResults(results: any[], knowledgePerformances: any[]): any[] {
        return results.sort((a, b) => {
            const scoreA = this.calculateWeightedScore(a.id, knowledgePerformances);
            const scoreB = this.calculateWeightedScore(b.id, knowledgePerformances);
            return scoreB - scoreA; // Descending order
        });
    }

    private static calculateWeightedScore(knowledgeItemId: string, knowledgePerformances: any[]): number {
        const performance = knowledgePerformances.find(p => p.knowledgeItemId === knowledgeItemId);
        if (!performance) return 0; // Or some default score
        // Weighted average: rewardScore * usageCount
        return performance.rewardScore * performance.usageCount;
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
