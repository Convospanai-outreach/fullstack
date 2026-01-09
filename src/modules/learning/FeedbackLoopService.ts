
import { prisma } from "@/lib/db";

export class FeedbackLoopService {

    /**
     * Captures a user's edit to AI-generated content.
     * This is the "Gold Mine" for fine-tuning.
     */
    async captureEdit(teamId: string, original: string, edited: string, context: any) {
        if (original === edited) return; // No learning signal

        // Calculate diff metrics
        const similarity = this.calculateSimilarity(original, edited);
        const lengthChange = edited.length - original.length;

        // Store in DB
        await prisma.agentFeedbackLoop.create({
            data: {
                teamId,
                originalText: original,
                editedText: edited,
                diff: { lengthChange, similarity },
                context: context ? JSON.parse(JSON.stringify(context)) : {},
            },
        });

        console.log(`[Feedback] Captured edit for team ${teamId}. Similarity: ${similarity.toFixed(2)}`);
    }

    /**
     * Quantifies "Model Drift" or Improvement.
     * - Trend > 0: Model is improving (edit distance decreasing).
     * - Trend < 0: Model is degrading (edits are getting heavier).
     */
    async calculateModelDrift(teamId: string, days: number = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const feedbacks = await prisma.agentFeedbackLoop.findMany({
            where: {
                teamId,
                createdAt: { gte: since }
            },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true, diff: true }
        });

        if (feedbacks.length < 10) return { status: "INSUFFICIENT_DATA" };

        // Extract similarity scores
        const scores = feedbacks.map(f => (f.diff as any)?.similarity || 0);

        // Simple Linear Regression (Slope)
        const slope = this.calculateSlope(scores);
        const avgSimilarity = scores.reduce((a, b) => a + b, 0) / scores.length;

        return {
            period: `${days} days`,
            sampleSize: feedbacks.length,
            averageSimilarity: avgSimilarity.toFixed(3),
            trend: slope > 0.001 ? "IMPROVING" : slope < -0.001 ? "DEGRADING" : "STABLE",
            driftScore: slope // positive means getting better
        };
    }

    /**
     * Exports dataset for RLHF / Fine-Tuning (JSONL format)
     */
    async exportTrainingData(teamId: string) {
        const records = await prisma.agentFeedbackLoop.findMany({
            where: { teamId },
            take: 1000,
        });

        // ChatML / OpenAI JSONL format
        return records.map(r => ({
            messages: [
                { role: "system", content: `Context: ${JSON.stringify(r.context || {})}` },
                { role: "user", content: "Draft the content based on the context." },
                { role: "assistant", content: r.editedText } // The "Ground Truth" is the edited version
            ]
        }));
    }

    // --- Helpers ---

    private calculateSimilarity(s1: string, s2: string): number {
        // Mock Jaccard/Levenshtein for now
        // 1.0 = Identical, 0.0 = Different
        const longer = s1.length > s2.length ? s1.length : s2.length;
        if (longer === 0) return 1.0;
        const editDistance = Math.abs(s1.length - s2.length); // Simplified
        return (longer - editDistance) / longer;
    }

    private calculateSlope(y: number[]): number {
        const n = y.length;
        if (n < 2) return 0;
        const x = Array.from({ length: n }, (_, i) => i);

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((acc, curr, i) => acc + curr * y[i], 0);
        const sumXX = x.reduce((acc, curr) => acc + curr * curr, 0);

        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }
}

export const feedbackLoop = new FeedbackLoopService();
