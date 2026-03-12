
import Groq from "groq-sdk";
import { BaseProvider } from "./BaseProvider.js";
import { ModelRequest, ModelResponse, LLMProvider, LLMError } from "../types.js";

export class GroqProvider extends BaseProvider {
    private client: Groq;

    constructor(apiKey: string) {
        super();
        this.client = new Groq({ apiKey });
    }

    getProviderName(): LLMProvider {
        return LLMProvider.GROQ;
    }

    async generate(request: ModelRequest): Promise<ModelResponse> {
        const startTime = Date.now();
        try {
            const completion = await this.client.chat.completions.create({
                model: request.model || "llama3-8b-8192",
                messages: [{ role: "user", content: request.prompt }],
                temperature: request.temperature || 0.7,
            });

            const content = completion.choices[0]?.message?.content || "";
            return {
                content,
                model: completion.model,
                provider: LLMProvider.GROQ,
                tokensIn: completion.usage?.prompt_tokens || 0,
                tokensOut: completion.usage?.completion_tokens || 0,
                latency: Date.now() - startTime,
                cost: 0 // Placeholder
            };
        } catch (error: any) {
            throw new LLMError(error.message, LLMProvider.GROQ, error.status);
        }
    }
}
