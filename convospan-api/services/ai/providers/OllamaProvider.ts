
import { BaseProvider } from "./BaseProvider.js";
import { ModelRequest, ModelResponse, LLMProvider, LLMError } from "../types.js";

export class OllamaProvider extends BaseProvider {
    private baseUrl: string;

    constructor(baseUrl?: string) {
        super();
        this.baseUrl = baseUrl || "http://localhost:11434";
    }

    getProviderName(): LLMProvider {
        return LLMProvider.OLLAMA;
    }

    async generate(request: ModelRequest): Promise<ModelResponse> {
        const startTime = Date.now();
        try {
            const response = await fetch(`${this.baseUrl}/api/generate`, {
                method: "POST",
                body: JSON.stringify({
                    model: request.model || "llama3",
                    prompt: request.prompt,
                    stream: false
                })
            });

            if (!response.ok) throw new Error(`Ollama error: ${response.status}`);
            const data = await response.json();

            return {
                content: data.response,
                model: data.model,
                provider: LLMProvider.OLLAMA,
                tokensIn: 0,
                tokensOut: 0,
                latency: Date.now() - startTime,
                cost: 0
            };
        } catch (error: any) {
            throw new LLMError(error.message, LLMProvider.OLLAMA);
        }
    }
}
