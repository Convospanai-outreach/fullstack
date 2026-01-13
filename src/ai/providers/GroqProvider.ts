import Groq from "groq-sdk";
import { BaseProvider } from "./BaseProvider";
import { LLMProvider, ModelRequest, ModelResponse, TaskComplexity, LLMError } from "../types";

/**
 * Groq Provider - Ultra-fast inference for Llama models
 * Ideal for routine tasks where speed matters
 */
export class GroqProvider extends BaseProvider {
    private client: Groq;

    constructor(apiKey: string) {
        super(apiKey);
        this.client = new Groq({ apiKey });
    }

    protected getBaseUrl(): string {
        return "https://api.groq.com/openai/v1";
    }

    getProviderName(): LLMProvider {
        return LLMProvider.GROQ;
    }

    protected getModelForComplexity(complexity: TaskComplexity): string {
        // Groq is optimized for speed, use for routine tasks
        // For strategic, we still use their best model
        return complexity === TaskComplexity.STRATEGIC
            ? "llama-3.1-70b-versatile"  // Larger model for complex tasks
            : "llama-3.1-8b-instant"; // Lightning fast for routine
    }

    protected async generateInternal(
        request: ModelRequest,
        model: string
    ): Promise<ModelResponse> {
        try {
            const completion = await this.client.chat.completions.create({
                model,
                messages: [
                    {
                        role: "system",
                        content: request.context?.systemPrompt || "You are a helpful AI assistant for sales outreach."
                    },
                    {
                        role: "user",
                        content: request.prompt
                    }
                ],
                max_tokens: request.maxTokens || 2048,
                temperature: request.temperature ?? 0.7,
            });

            const content = completion.choices[0]?.message?.content || "";
            const tokensIn = completion.usage?.prompt_tokens || 0;
            const tokensOut = completion.usage?.completion_tokens || 0;

            // Groq pricing (extremely cheap due to custom hardware)
            const costPerMillionIn = 0.05;  // Very affordable
            const costPerMillionOut = 0.08;

            return {
                content,
                provider: LLMProvider.GROQ,
                model,
                tokensIn,
                tokensOut,
                latency: 0, // Will be set by base class (typically <100ms!)
                cost: this.calculateCost(tokensIn, tokensOut, costPerMillionIn, costPerMillionOut)
            };
        } catch (error: any) {
            const statusCode = error?.status || error?.response?.status;
            const retryable = statusCode !== 401 && statusCode !== 429;

            throw new LLMError(
                error?.message || "Groq API error",
                LLMProvider.GROQ,
                statusCode,
                retryable
            );
        }
    }
}
