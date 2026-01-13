import OpenAI from "openai";
import { BaseProvider } from "./BaseProvider";
import { LLMProvider, ModelRequest, ModelResponse, TaskComplexity, LLMError } from "../types";

export class OpenAIProvider extends BaseProvider {
    private client: OpenAI;

    constructor(apiKey: string) {
        super(apiKey);
        this.client = new OpenAI({ apiKey });
    }

    protected getBaseUrl(): string {
        return "https://api.openai.com/v1";
    }

    getProviderName(): LLMProvider {
        return LLMProvider.OPENAI;
    }

    protected getModelForComplexity(complexity: TaskComplexity): string {
        return complexity === TaskComplexity.STRATEGIC
            ? "gpt-4o"  // For complex reasoning
            : "gpt-4o-mini"; // For routine tasks
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

            // Pricing as of Jan 2026 (approximate)
            const costPerMillionIn = model === "gpt-4o" ? 2.50 : 0.15;
            const costPerMillionOut = model === "gpt-4o" ? 10.00 : 0.60;

            return {
                content,
                provider: LLMProvider.OPENAI,
                model,
                tokensIn,
                tokensOut,
                latency: 0, // Will be set by base class
                cost: this.calculateCost(tokensIn, tokensOut, costPerMillionIn, costPerMillionOut)
            };
        } catch (error: any) {
            const statusCode = error?.status || error?.response?.status;
            const retryable = statusCode !== 401 && statusCode !== 429;

            throw new LLMError(
                error?.message || "OpenAI API error",
                LLMProvider.OPENAI,
                statusCode,
                retryable
            );
        }
    }
}
