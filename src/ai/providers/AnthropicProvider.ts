import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider } from "./BaseProvider";
import { LLMProvider, ModelRequest, ModelResponse, TaskComplexity, LLMError } from "../types";

export class AnthropicProvider extends BaseProvider {
    private client: Anthropic;

    constructor(apiKey: string) {
        super(apiKey);
        this.client = new Anthropic({ apiKey });
    }

    protected getBaseUrl(): string {
        return "https://api.anthropic.com";
    }

    getProviderName(): LLMProvider {
        return LLMProvider.ANTHROPIC;
    }

    protected getModelForComplexity(complexity: TaskComplexity): string {
        // Claude 3.5 Sonnet is excellent for strategic reasoning
        // Haiku is fast and cheap for routine
        return complexity === TaskComplexity.STRATEGIC
            ? "claude-3-5-sonnet-20241022"  // Latest Sonnet
            : "claude-3-5-haiku-20241022"; // Fast Haiku
    }

    protected async generateInternal(
        request: ModelRequest,
        model: string
    ): Promise<ModelResponse> {
        try {
            const message = await this.client.messages.create({
                model,
                max_tokens: request.maxTokens || 2048,
                system: request.context?.systemPrompt || "You are a helpful AI assistant for sales outreach.",
                messages: [
                    {
                        role: "user",
                        content: request.prompt
                    }
                ],
                temperature: request.temperature ?? 0.7,
            });

            const content = message.content[0]?.type === 'text'
                ? message.content[0].text
                : "";

            const tokensIn = message.usage.input_tokens;
            const tokensOut = message.usage.output_tokens;

            // Claude 3.5 pricing (as of Jan 2026)
            const costPerMillionIn = model.includes("sonnet") ? 3.00 : 0.80;
            const costPerMillionOut = model.includes("sonnet") ? 15.00 : 4.00;

            return {
                content,
                provider: LLMProvider.ANTHROPIC,
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
                error?.message || "Anthropic API error",
                LLMProvider.ANTHROPIC,
                statusCode,
                retryable
            );
        }
    }
}
