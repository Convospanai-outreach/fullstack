import { BaseProvider } from "./BaseProvider";
import { LLMProvider, ModelRequest, ModelResponse, TaskComplexity, LLMError } from "../types";

/**
 * Ollama Provider - Local execution for privacy and cost savings
 * supports model toggling and offline capabilities
 */
export class OllamaProvider extends BaseProvider {
    private customBaseUrl: string;

    constructor(baseUrl: string = "http://localhost:11434") {
        super("ollama-no-key", 3, 60000); // Longer timeout for local inference
        this.customBaseUrl = baseUrl;
    }

    protected getBaseUrl(): string {
        return this.customBaseUrl;
    }

    getProviderName(): LLMProvider {
        return LLMProvider.OLLAMA;
    }

    protected getModelForComplexity(complexity: TaskComplexity): string {
        // Users can override this via env, but defaults:
        return complexity === TaskComplexity.STRATEGIC
            ? "llama3"
            : "phi3"; // phi3 is a good micro model
    }

    protected async generateInternal(
        request: ModelRequest,
        model: string
    ): Promise<ModelResponse> {
        try {
            const endpoint = `${this.getBaseUrl()}/api/chat`;

            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        {
                            role: "system",
                            content: request.context?.systemPrompt || "You are a helpful AI assistant."
                        },
                        {
                            role: "user",
                            content: request.prompt
                        }
                    ],
                    stream: false,
                    options: {
                        temperature: request.temperature ?? 0.7,
                        num_ctx: 4096
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            const content = data.message?.content || "";
            // Ollama returns eval_count (output) and prompt_eval_count (input)
            const tokensIn = data.prompt_eval_count || 0;
            const tokensOut = data.eval_count || 0;

            // Cost is 0 for local
            const cost = 0;

            return {
                content,
                provider: LLMProvider.OLLAMA,
                model: data.model || model,
                tokensIn,
                tokensOut,
                latency: data.total_duration ? data.total_duration / 1000000 : 0, // ns to ms
                cost
            };
        } catch (error: any) {
            // Check if it's a connection error (Ollama not running)
            const isConnectionError = error?.cause?.code === 'ECONNREFUSED' || error?.message?.includes('fetch failed');

            throw new LLMError(
                error?.message || "Ollama Execution failed",
                LLMProvider.OLLAMA,
                isConnectionError ? 503 : 500,
                !isConnectionError // Don't retry if service is down
            );
        }
    }
}
