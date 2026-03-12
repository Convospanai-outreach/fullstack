
import OpenAI from "openai";
import { BaseProvider } from "./BaseProvider.js";
import { ModelRequest, ModelResponse, LLMProvider, LLMError } from "../types.js";

export class OpenAIProvider extends BaseProvider {
    private client: OpenAI;

    constructor(apiKey: string) {
        super();
        this.client = new OpenAI({ apiKey });
    }

    getProviderName(): LLMProvider {
        return LLMProvider.OPENAI;
    }

    async generate(request: ModelRequest): Promise<ModelResponse> {
        const startTime = Date.now();
        try {
            const completion = await this.client.chat.completions.create({
                model: request.model || "gpt-4o-mini",
                messages: [{ role: "user", content: request.prompt }],
                temperature: request.temperature || 0.7,
                max_tokens: request.maxTokens,
            });

            const content = completion.choices[0]?.message?.content || "";
            return {
                content,
                model: completion.model,
                provider: LLMProvider.OPENAI,
                usage: completion.usage,
                tokensIn: completion.usage?.prompt_tokens || 0,
                tokensOut: completion.usage?.completion_tokens || 0,
                latency: Date.now() - startTime,
                cost: this.calculateCost(completion.model, completion.usage?.prompt_tokens || 0, completion.usage?.completion_tokens || 0)
            };
        } catch (error: any) {
            throw new LLMError(error.message, LLMProvider.OPENAI, error.status);
        }
    }

    private calculateCost(model: string, tokensIn: number, tokensOut: number): number {
        // [PHASE 9] Dynamic Pricing model integration
        // Placeholders for gpt-4o-mini Pricing
        const rateIn = model.includes("mini") ? 0.00015 / 1000 : 0.005 / 1000;
        const rateOut = model.includes("mini") ? 0.0006 / 1000 : 0.015 / 1000;
        return (tokensIn * rateIn) + (tokensOut * rateOut);
    }
}
