import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseProvider } from "./BaseProvider";
import { LLMProvider, ModelRequest, ModelResponse, TaskComplexity, LLMError } from "../types";

export class GeminiProvider extends BaseProvider {
    private client: GoogleGenerativeAI;

    constructor(apiKey: string) {
        super(apiKey);
        this.client = new GoogleGenerativeAI(apiKey);
    }

    protected getBaseUrl(): string {
        return "https://generativelanguage.googleapis.com";
    }

    getProviderName(): LLMProvider {
        return LLMProvider.GEMINI;
    }

    protected getModelForComplexity(complexity: TaskComplexity): string {
        return complexity === TaskComplexity.STRATEGIC
            ? "gemini-1.5-pro"  // For complex reasoning
            : "gemini-1.5-flash"; // For routine tasks (fast & cheap)
    }

    protected async generateInternal(
        request: ModelRequest,
        model: string
    ): Promise<ModelResponse> {
        try {
            const genModel = this.client.getGenerativeModel({ model });

            const systemInstruction = request.context?.systemPrompt ||
                "You are a helpful AI assistant for sales outreach.";

            const prompt = `${systemInstruction}\n\n${request.prompt}`;

            const result = await genModel.generateContent({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: request.maxTokens || 2048,
                    temperature: request.temperature ?? 0.7,
                }
            });

            const content = result.response.text();

            // Gemini doesn't always provide token counts, estimate if needed
            const tokensIn = result.response.usageMetadata?.promptTokenCount ||
                this.estimateTokens(prompt);
            const tokensOut = result.response.usageMetadata?.candidatesTokenCount ||
                this.estimateTokens(content);

            // Pricing as of Jan 2026 (approximate)
            const costPerMillionIn = model === "gemini-1.5-pro" ? 1.25 : 0.075;
            const costPerMillionOut = model === "gemini-1.5-pro" ? 5.00 : 0.30;

            return {
                content,
                provider: LLMProvider.GEMINI,
                model,
                tokensIn,
                tokensOut,
                latency: 0, // Will be set by base class
                cost: this.calculateCost(tokensIn, tokensOut, costPerMillionIn, costPerMillionOut)
            };
        } catch (error: any) {
            const statusCode = error?.status || 500;
            const retryable = statusCode !== 401 && statusCode !== 403;

            throw new LLMError(
                error?.message || "Gemini API error",
                LLMProvider.GEMINI,
                statusCode,
                retryable
            );
        }
    }
}
