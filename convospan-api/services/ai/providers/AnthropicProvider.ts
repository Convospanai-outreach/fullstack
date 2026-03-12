
import Anthropic from "@anthropic-ai/sdk";
import { BaseProvider } from "./BaseProvider.js";
import { ModelRequest, ModelResponse, LLMProvider, LLMError } from "../types.js";

export class AnthropicProvider extends BaseProvider {
    private client: Anthropic;

    constructor(apiKey: string) {
        super();
        this.client = new Anthropic({ apiKey });
    }

    getProviderName(): LLMProvider {
        return LLMProvider.ANTHROPIC;
    }

    async generate(request: ModelRequest): Promise<ModelResponse> {
        const startTime = Date.now();
        try {
            const message = await this.client.messages.create({
                model: request.model || "claude-3-5-sonnet-20240620",
                max_tokens: request.maxTokens || 1024,
                messages: [{ role: "user", content: request.prompt }],
                temperature: request.temperature || 0.7,
            });

            const content = message.content[0]?.type === 'text' ? message.content[0].text : "";
            
            return {
                content,
                model: message.model,
                provider: LLMProvider.ANTHROPIC,
                tokensIn: message.usage.input_tokens,
                tokensOut: message.usage.output_tokens,
                latency: Date.now() - startTime,
                cost: (message.usage.input_tokens * (3 / 1000000)) + (message.usage.output_tokens * (15 / 1000000))
            };
        } catch (error: any) {
            throw new LLMError(error.message, LLMProvider.ANTHROPIC, error.status);
        }
    }
}
