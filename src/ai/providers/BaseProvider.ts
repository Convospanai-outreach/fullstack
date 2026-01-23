import { LLMProvider, ModelRequest, ModelResponse, LLMError, TaskComplexity } from "../types";

/**
 * Base class for all LLM providers
 * Implements common functionality like retry logic, error handling, token counting
 */
export abstract class BaseProvider {
    protected apiKey: string;
    protected baseUrl: string;
    protected maxRetries: number;
    protected timeout: number;

    constructor(apiKey: string, maxRetries: number = 3, timeout: number = 30000) {
        this.apiKey = apiKey;
        this.maxRetries = maxRetries;
        this.timeout = timeout;
        this.baseUrl = this.getBaseUrl();
    }

    /**
     * Each provider implements its own base URL
     */
    protected abstract getBaseUrl(): string;

    /**
     * Each provider implements its own generation logic
     */
    protected abstract generateInternal(
        request: ModelRequest,
        model: string
    ): Promise<ModelResponse>;

    /**
     * Get the appropriate model name based on task complexity
     */
    protected abstract getModelForComplexity(complexity: TaskComplexity): string;

    /**
     * Get provider name
     */
    abstract getProviderName(): LLMProvider;

    /**
     * Public method with retry logic
     */
    async generate(request: ModelRequest): Promise<ModelResponse> {
        const complexity = request.complexity || TaskComplexity.ROUTINE;
        const model = this.getModelForComplexity(complexity);

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const startTime = Date.now();
                const response = await this.generateInternal(request, model);
                const latency = Date.now() - startTime;

                return {
                    ...response,
                    latency,
                    provider: this.getProviderName()
                };
            } catch (error) {
                lastError = error as Error;

                // Don't retry on non-retryable errors
                if (error instanceof LLMError && !error.retryable) {
                    throw error;
                }

                // Exponential backoff
                if (attempt < this.maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new LLMError(
            `Failed after ${this.maxRetries} attempts: ${lastError?.message}`,
            this.getProviderName(),
            undefined,
            false
        );
    }

    /**
     * Estimate token count (rough approximation)
     * Can be overridden by providers with their own tokenizers
     */
    protected estimateTokens(text: string): number {
        // Rough estimate: ~4 characters per token for English
        return Math.ceil(text.length / 4);
    }

    /**
     * Calculate cost based on token usage
     */
    protected calculateCost(
        tokensIn: number,
        tokensOut: number,
        costPerMillionIn: number,
        costPerMillionOut: number
    ): number {
        const costIn = (tokensIn / 1000000) * costPerMillionIn;
        const costOut = (tokensOut / 1000000) * costPerMillionOut;
        return costIn + costOut;
    }
}
