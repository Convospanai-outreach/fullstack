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
        try {
            const traces = await prisma.aiTrace.findMany({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
                    }
                },
                orderBy: { createdAt: 'desc' },
                take: 1000 // Limit for performance
            });

            if (traces.length === 0) {
                return [];
            }

            // Group by model
            const stats: Record<string, any> = {};

            // Cost assumptions (Input/Output mixed or simplified)
            const COST_PER_1K_TOKENS: Record<string, number> = {
                "gpt-4o": 0.015,
                "gpt-4-turbo": 0.01,
                "claude-3-opus": 0.03,
                "gemini-1.5-pro": 0.007,
                "gemini-1.5-flash": 0.0007,
                "unknown": 0.001
            };

            traces.forEach(t => {
                const model = t.model || 'unknown';
                if (!stats[model]) {
                    stats[model] = {
                        name: model,
                        count: 0,
                        avgLatency: 0,
                        totalTokens: 0,
                        cost: 0,
                        errors: 0,
                        count_success: 0,
                        latencyHistory: [],
                        color: this.getModelColor(model)
                    };
                }

                const s = stats[model];
                s.count++;
                // Rolling average latency
                s.avgLatency = (s.avgLatency * (s.count - 1) + t.latency) / s.count;
                s.totalTokens += t.tokens;

                // Estimate cost
                const rate = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS["unknown"] || 0.001;
                s.cost += (t.tokens / 1000) * rate;

                // Reliability (Mock logic)
                s.count_success++;

                // Add trace point for chart (sample if too many?)
                if (s.latencyHistory.length < 50) {
                    s.latencyHistory.push({ x: t.createdAt, y: t.latency });
                }
            });

            return Object.values(stats).map((s: any) => ({
                ...s,
                reliability: s.count > 0 ? Math.round((s.count_success / s.count) * 1000) / 10 : 0,
                avgLatency: Math.round(s.avgLatency) / 1000 // Convert ms to s
            }));

        } catch (error) {
            console.error("Failed to get AI metrics", error);
            return [];
        }
    }

    private static getModelColor(model: string) {
        if (model.includes("gpt")) return "text-green-400";
        if (model.includes("claude")) return "text-orange-400";
        if (model.includes("gemini")) return "text-blue-400";
        return "text-slate-400";
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

export const aiStatsService = new AiStatsService();
