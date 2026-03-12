
import { GoogleGenerativeAI } from "@google/generative-ai";
import { BaseProvider } from "./BaseProvider.js";
import { ModelRequest, ModelResponse, LLMProvider, LLMError } from "../types.js";

export class GeminiProvider extends BaseProvider {
    private client: GoogleGenerativeAI;

    constructor(apiKey: string) {
        super();
        this.client = new GoogleGenerativeAI(apiKey);
    }

    getProviderName(): LLMProvider {
        return LLMProvider.GEMINI;
    }

    async generate(request: ModelRequest): Promise<ModelResponse> {
        const startTime = Date.now();
        try {
            const model = this.client.getGenerativeModel({ model: request.model || "gemini-1.5-flash" });
            const result = await model.generateContent(request.prompt);
            const response = await result.response;
            const text = response.text();

            return {
                content: text,
                model: request.model || "gemini-1.5-flash",
                provider: LLMProvider.GEMINI,
                tokensIn: 0, // Gemini doesn't expose usage easily in simple call
                tokensOut: 0,
                latency: Date.now() - startTime,
                cost: 0 // Free tier usually
            };
        } catch (error: any) {
            throw new LLMError(error.message, LLMProvider.GEMINI);
        }
    }
}
