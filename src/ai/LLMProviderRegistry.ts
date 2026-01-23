import { Redis } from "ioredis";
import { LLMProvider, ProviderHealth } from "./types";
import {
    OpenAIProvider,
    GeminiProvider,
    GroqProvider,
    AnthropicProvider,
    BaseProvider,
    OllamaProvider
} from "./providers";

/**
 * LLM Provider Registry
 * Manages multiple LLM providers with health tracking and automatic failover
 */
export class LLMProviderRegistry {
    private providers: Map<LLMProvider, BaseProvider> = new Map();
    private healthStatus: Map<LLMProvider, ProviderHealth> = new Map();
    private redis: Redis | null = null;
    private readonly HEALTH_CHECK_INTERVAL = 60000; // 1 minute
    private readonly MAX_CONSECUTIVE_FAILURES = 3;

    constructor() {
        this.initializeProviders();

        // Initialize Redis for health status caching (optional)
        if (process.env['REDIS_URL']) {
            this.redis = new Redis(process.env['REDIS_URL']);
        }

        // Start health monitoring
        this.startHealthMonitoring();
    }

    private initializeProviders() {
        // Initialize all configured providers
        if (process.env['OPENAI_API_KEY']) {
            this.providers.set(
                LLMProvider.OPENAI,
                new OpenAIProvider(process.env['OPENAI_API_KEY']!)
            );
            this.initHealthStatus(LLMProvider.OPENAI);
        }

        if (process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY']) {
            const apiKey = process.env['GOOGLE_API_KEY'] || process.env['GEMINI_API_KEY']!;
            this.providers.set(
                LLMProvider.GEMINI,
                new GeminiProvider(apiKey)
            );
            this.initHealthStatus(LLMProvider.GEMINI);
        }

        if (process.env['GROQ_API_KEY']) {
            this.providers.set(
                LLMProvider.GROQ,
                new GroqProvider(process.env['GROQ_API_KEY']!)
            );
            this.initHealthStatus(LLMProvider.GROQ);
        }

        if (process.env['ANTHROPIC_API_KEY']) {
            this.providers.set(
                LLMProvider.ANTHROPIC,
                new AnthropicProvider(process.env['ANTHROPIC_API_KEY']!)
            );
            this.initHealthStatus(LLMProvider.ANTHROPIC);
        }

        // Always check for local Ollama, or if explicit URL is provided
        if (process.env['OLLAMA_BASE_URL'] || process.env['ENABLE_LOCAL_LLM'] === 'true') {
            this.providers.set(
                LLMProvider.OLLAMA,
                new OllamaProvider(process.env['OLLAMA_BASE_URL'])
            );
            this.initHealthStatus(LLMProvider.OLLAMA);
        }

        if (this.providers.size === 0) {
            console.warn("[LLM Registry] No LLM providers configured. Please set API keys in .env");
        }
    }

    private initHealthStatus(provider: LLMProvider) {
        this.healthStatus.set(provider, {
            provider,
            isHealthy: true,
            lastCheck: new Date(),
            latency: 0,
            errorRate: 0,
            consecutiveFailures: 0
        });
    }

    /**
     * Get provider by name
     */
    getProvider(provider: LLMProvider): BaseProvider | undefined {
        return this.providers.get(provider);
    }

    /**
     * Get all healthy providers sorted by priority
     * Priority: Groq (fastest & cheapest) > Gemini > OpenAI > Anthropic
     */
    getHealthyProviders(): LLMProvider[] {
        const priorityOrder = [
            LLMProvider.GROQ,
            LLMProvider.GEMINI,
            LLMProvider.OPENAI,
            LLMProvider.ANTHROPIC
        ];

        return priorityOrder.filter(provider => {
            const health = this.healthStatus.get(provider);
            return health?.isHealthy && this.providers.has(provider);
        });
    }

    /**
     * Get fallback chain for a given provider
     */
    getFallbackChain(preferredProvider?: LLMProvider): LLMProvider[] {
        const healthy = this.getHealthyProviders();

        if (!preferredProvider) {
            return healthy;
        }

        // Put preferred provider first, then others
        const chain = [preferredProvider];
        healthy.forEach(provider => {
            if (provider !== preferredProvider) {
                chain.push(provider);
            }
        });

        return chain.filter(p => this.providers.has(p));
    }

    /**
     * Mark a provider as unhealthy after failure
     */
    recordFailure(provider: LLMProvider, _error: Error) {
        const health = this.healthStatus.get(provider);
        if (!health) return;

        health.consecutiveFailures++;
        health.lastCheck = new Date();

        if (health.consecutiveFailures >= this.MAX_CONSECUTIVE_FAILURES) {
            health.isHealthy = false;
            console.error(`[LLM Registry] Provider ${provider} marked as unhealthy after ${health.consecutiveFailures} failures`);
        }

        this.healthStatus.set(provider, health);
        this.cacheHealthStatus(provider, health);
    }

    /**
     * Record successful request
     */
    recordSuccess(provider: LLMProvider, latency: number) {
        const health = this.healthStatus.get(provider);
        if (!health) return;

        health.consecutiveFailures = 0;
        health.isHealthy = true;
        health.latency = latency;
        health.lastCheck = new Date();

        this.healthStatus.set(provider, health);
        this.cacheHealthStatus(provider, health);
    }

    /**
     * Get health status for all providers
     */
    getHealthStatus(): Map<LLMProvider, ProviderHealth> {
        return new Map(this.healthStatus);
    }

    /**
     * Cache health status in Redis
     */
    private async cacheHealthStatus(provider: LLMProvider, health: ProviderHealth) {
        if (!this.redis) return;

        try {
            await this.redis.setex(
                `llm:health:${provider}`,
                300, // 5 minutes TTL
                JSON.stringify(health)
            );
        } catch (error) {
            console.error("[LLM Registry] Failed to cache health status:", error);
        }
    }

    /**
     * Periodic health monitoring
     */
    private startHealthMonitoring() {
        setInterval(() => {
            this.performHealthChecks();
        }, this.HEALTH_CHECK_INTERVAL);
    }

    /**
     * Perform health checks on all providers
     */
    private async performHealthChecks() {
        const testPrompt = "Say 'OK' if you can hear me.";

        for (const [providerName, provider] of this.providers) {
            try {
                const startTime = Date.now();
                await provider.generate({
                    prompt: testPrompt,
                    maxTokens: 10
                });
                const latency = Date.now() - startTime;

                this.recordSuccess(providerName, latency);
            } catch (error) {
                this.recordFailure(providerName, error as Error);
            }
        }
    }

    /**
     * Cleanup resources
     */
    async destroy() {
        if (this.redis) {
            await this.redis.quit();
        }
    }
}

// Singleton instance
export const providerRegistry = new LLMProviderRegistry();
