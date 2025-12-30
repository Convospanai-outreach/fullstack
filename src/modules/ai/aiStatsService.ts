import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export interface LLMMetrics {
    model: string;
    latency: number;
    tokens: number;
    success: boolean;
    stepName: string;
}

export class AiStatsService {
    /**
     * Records a performance trace for an LLM execution
     */
    static async recordTrace(metrics: LLMMetrics, runId?: string) {
        try {
            await prisma.aiTrace.create({
                data: {
                    model: metrics.model,
                    latency: metrics.latency,
                    tokens: metrics.tokens,
                    stepName: metrics.stepName,
                    runId: runId || null,
                }
            });
        } catch (error) {
            logger.error("[AiStatsService] Failed to record trace", { error });
        }
    }

    /**
     * Get aggregated performance stats per model
     */
    static async getPerformanceMetrics() {
        const traces = await prisma.aiTrace.findMany({
            where: {
                createdAt: {
                    gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Group by model
        const stats: Record<string, any> = {};

        traces.forEach(t => {
            const model = t.model || 'unknown';
            if (!stats[model]) {
                stats[model] = {
                    name: model,
                    count: 0,
                    avgLatency: 0,
                    totalTokens: 0,
                    errors: 0,
                    latencyHistory: []
                };
            }

            stats[model].count++;
            stats[model].avgLatency = (stats[model].avgLatency * (stats[model].count - 1) + t.latency) / stats[model].count;
            stats[model].totalTokens += t.tokens;
            stats[model].latencyHistory.push({ x: t.createdAt, y: t.latency });
        });

        return Object.values(stats);
    }

    /**
     * Mock data for UI development if no real data exists
     */
    static getMockMetrics() {
        return [
            {
                name: "Gemini 1.5 Pro",
                count: 1240,
                avgLatency: 1.2,
                totalTokens: 850000,
                cost: 2.97,
                reliability: 99.8,
                color: "text-blue-400"
            },
            {
                name: "GPT-4o",
                count: 850,
                avgLatency: 2.1,
                totalTokens: 420000,
                cost: 8.40,
                reliability: 99.2,
                color: "text-green-400"
            },
            {
                name: "Claude 3 Opus",
                count: 120,
                avgLatency: 4.5,
                totalTokens: 150000,
                cost: 11.25,
                reliability: 98.5,
                color: "text-orange-400"
            },
            {
                name: "Local Mistral",
                count: 4500,
                avgLatency: 0.4,
                totalTokens: 2100000,
                cost: 0.00,
                reliability: 100,
                color: "text-slate-400"
            }
        ];
    }
}
