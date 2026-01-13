
import { LLMProvider, TaskComplexity, ModelRequest, ModelResponse, LLMError } from "./types";
import { providerRegistry } from "./LLMProviderRegistry";
import { prisma } from "@/lib/db";
import { Redis } from "ioredis";

export { TaskComplexity };
export type { ModelRequest };

/**
 * Enhanced ModelGateway with multi-provider support, caching, and cost optimization
 */
export class ModelGateway {
    private redis: Redis | null = null;
    private readonly CACHE_TTL = 3600; // 1 hour cache for identical prompts

    constructor() {
        // Initialize Redis for caching (optional)
        if (process.env['REDIS_URL']) {
            this.redis = new Redis(process.env['REDIS_URL']);
        }
    }

    /**
     * Intelligently routes the request to the most cost-effective model
     * with automatic fallback on failure
     */
    async generate(request: ModelRequest): Promise<string> {
        const complexity = request.complexity || this.analyzeComplexity(request.prompt);

        // Check cache first
        const cached = await this.checkCache(request.prompt, complexity);
        if (cached) {
            console.log("[Gateway] Cache hit, returning cached response");
            return cached;
        }

        // Determine preferred provider based on complexity
        const preferredProvider = this.selectPreferredProvider(complexity);
        const fallbackChain = providerRegistry.getFallbackChain(preferredProvider);

        if (fallbackChain.length === 0) {
            throw new Error("No LLM providers available. Please configure API keys.");
        }

        // Try providers in fallback chain
        let lastError: Error | null = null;

        for (const providerName of fallbackChain) {
            try {
                console.log(`[Gateway] Attempting ${providerName} for ${complexity} task`);

                const provider = providerRegistry.getProvider(providerName);
                if (!provider) continue;

                const response = await provider.generate(request);

                // Record success
                providerRegistry.recordSuccess(providerName, response.latency);

                // Log usage for analytics
                await this.logUsage(request, response);

                // Cache the response
                await this.cacheResponse(request.prompt, complexity, response.content);

                console.log(
                    `[Gateway] Success: ${providerName} | ` +
                    `${response.model} | ` +
                    `${response.latency}ms | ` +
                    `$${response.cost.toFixed(4)}`
                );

                return response.content;
            } catch (error) {
                lastError = error as Error;

                if (error instanceof LLMError) {
                    providerRegistry.recordFailure(providerName, error);
                    console.warn(
                        `[Gateway] ${providerName} failed: ${error.message}. ` +
                        `Trying next provider...`
                    );
                } else {
                    console.error(`[Gateway] Unexpected error from ${providerName}:`, error);
                }
            }
        }

        // All providers failed
        throw new Error(
            `All LLM providers failed. Last error: ${lastError?.message || "Unknown error"}`
        );
    }

    /**
     * Select preferred provider based on task complexity
     */
    private selectPreferredProvider(complexity: TaskComplexity): LLMProvider {
        if (complexity === TaskComplexity.STRATEGIC) {
            // For strategic tasks, prefer quality over cost
            // Priority: Claude > GPT-4o > Gemini Pro
            const preferred = [LLMProvider.ANTHROPIC, LLMProvider.OPENAI, LLMProvider.GEMINI];
            return preferred.find(p => providerRegistry.getProvider(p)) || LLMProvider.GROQ;
        } else {
            // For routine tasks, prefer speed and cost
            // Priority: Groq > Gemini Flash > GPT-4o-mini
            return LLMProvider.GROQ;
        }
    }

    /**
     * Enhanced complexity analysis
     * TODO: Replace with a lightweight classifier or RouteLLM
     */
    private analyzeComplexity(prompt: string): TaskComplexity {
        const p = prompt.toLowerCase();

        // Strategic indicators
        const strategicKeywords = [
            "strategy", "creative", "plan", "design", "analyze",
            "evaluate", "compare", "recommend", "brainstorm",
            "complex", "detailed", "comprehensive"
        ];

        // Routine indicators
        const routineKeywords = [
            "extract", "classify", "format", "summarize",
            "list", "find", "check", "validate"
        ];

        const strategicScore = strategicKeywords.filter(kw => p.includes(kw)).length;
        const routineScore = routineKeywords.filter(kw => p.includes(kw)).length;

        // Long prompts tend to be strategic
        if (p.length > 1000) {
            return TaskComplexity.STRATEGIC;
        }

        // If more strategic keywords, classify as strategic
        if (strategicScore > routineScore) {
            return TaskComplexity.STRATEGIC;
        }

        return TaskComplexity.ROUTINE;
    }

    /**
     * Check cache for existing response
     */
    private async checkCache(prompt: string, complexity: TaskComplexity): Promise<string | null> {
        if (!this.redis) return null;

        try {
            const cacheKey = this.getCacheKey(prompt, complexity);
            const cached = await this.redis.get(cacheKey);
            return cached;
        } catch (error) {
            console.error("[Gateway] Cache check failed:", error);
            return null;
        }
    }

    /**
     * Cache response for future use
     */
    private async cacheResponse(prompt: string, complexity: TaskComplexity, response: string) {
        if (!this.redis) return;

        try {
            const cacheKey = this.getCacheKey(prompt, complexity);
            await this.redis.setex(cacheKey, this.CACHE_TTL, response);
        } catch (error) {
            console.error("[Gateway] Cache write failed:", error);
        }
    }

    /**
     * Generate cache key
     */
    private getCacheKey(prompt: string, complexity: TaskComplexity): string {
        // Use a hash of the prompt for consistency
        const crypto = require('crypto');
        const hash = crypto.createHash('sha256').update(prompt).digest('hex').substring(0, 16);
        return `llm:cache:${complexity}:${hash}`;
    }

    /**
     * Log usage to database for analytics
     */
    private async logUsage(request: ModelRequest, response: ModelResponse) {
        try {
            await prisma.lLMUsageLog.create({
                data: {
                    teamId: request.teamId || 'system',
                    provider: response.provider,
                    model: response.model,
                    taskType: request.complexity || TaskComplexity.ROUTINE,
                    tokensIn: response.tokensIn,
                    tokensOut: response.tokensOut,
                    cost: response.cost,
                    latency: response.latency,
                    success: true,
                }
            });
        } catch (error) {
            // Don't fail the request if logging fails
            console.error("[Gateway] Failed to log usage:", error);
        }
    }

    /**
     * Get usage statistics for a team
     */
    async getUsageStats(teamId: string, days: number = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const logs = await prisma.lLMUsageLog.findMany({
            where: {
                teamId,
                createdAt: { gte: since }
            },
            select: {
                provider: true,
                model: true,
                taskType: true,
                tokensIn: true,
                tokensOut: true,
                cost: true,
                latency: true,
                createdAt: true
            }
        });

        // Aggregate statistics
        const stats = {
            totalRequests: logs.length,
            totalCost: logs.reduce((sum, log) => sum + log.cost, 0),
            totalTokens: logs.reduce((sum, log) => sum + log.tokensIn + log.tokensOut, 0),
            avgLatency: logs.reduce((sum, log) => sum + log.latency, 0) / (logs.length || 1),
            byProvider: {} as Record<string, { requests: number; cost: number }>,
            byTaskType: {} as Record<string, { requests: number; cost: number }>
        };

        logs.forEach(log => {
            // By provider
            if (!stats.byProvider[log.provider]) {
                stats.byProvider[log.provider] = { requests: 0, cost: 0 };
            }
            stats.byProvider[log.provider].requests++;
            stats.byProvider[log.provider].cost += log.cost;

            // By task type
            if (!stats.byTaskType[log.taskType]) {
                stats.byTaskType[log.taskType] = { requests: 0, cost: 0 };
            }
            stats.byTaskType[log.taskType].requests++;
            stats.byTaskType[log.taskType].cost += log.cost;
        });

        return stats;
    }

    /**
     * Get provider health status
     */
    getProviderHealth() {
        const healthMap = providerRegistry.getHealthStatus();
        return Array.from(healthMap.entries()).map(([provider, health]) => ({
            provider,
            ...health
        }));
    }
}

export const modelGateway = new ModelGateway();
