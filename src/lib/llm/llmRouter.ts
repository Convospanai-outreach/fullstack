import { generateWithGemini } from "@/ai/gemini";
import { logger } from "@/lib/logger";
import { AiStatsService } from "@/modules/ai/aiStatsService";

export interface LLMOptions {
    provider: string;
    prompt: string;
    context?: any;
    temperature?: number;
    stepName?: string;
}

/**
 * LLM Router - Vendor Agnostic Abstraction Layer
 * This handles steering prompts to different providers based on user preference or cost/latency requirements.
 */
export async function runLLM({
    provider,
    prompt,
    context: _context = {},
    temperature: _temperature = 0.7,
    stepName = "Direct Request"
}: LLMOptions): Promise<string> {
    logger.info(`[LLM Router] Routing request to ${provider}`, { provider, promptLength: prompt.length });
    const startTime = Date.now();

    try {
        let response = "";
        switch (provider) {
            case 'gemini':
            case 'gemini-1.5-pro':
            case 'gemini-1.5-flash':
                response = await generateWithGemini(prompt, provider === 'gemini' ? 'gemini-1.5-pro' : provider);
                break;

            case 'gpt4':
            case 'gpt-4o':
                // Placeholder for OpenAI integration
                logger.warn("[LLM Router] GPT-4 requested but not fully implemented. Falling back to Gemini.");
                response = await generateWithGemini(`[GPT-4 Fallback] ${prompt}`);
                break;

            case 'claude':
            case 'claude-3-opus':
                // Placeholder for Anthropic integration
                logger.warn("[LLM Router] Claude requested but not fully implemented. Falling back to Gemini.");
                response = await generateWithGemini(`[Claude Fallback] ${prompt}`);
                break;

            case 'local':
                // Placeholder for local inference (e.g. Ollama)
                logger.warn("[LLM Router] Local LLM requested but not available. Falling back to Gemini.");
                response = await generateWithGemini(`[Local Fallback] ${prompt}`);
                break;

            default:
                logger.error(`[LLM Router] Unsupported provider requested: ${provider}`);
                throw new Error(`Unsupported LLM provider: ${provider}`);
        }

        const duration = (Date.now() - startTime) / 1000;
        // Simple token estimation: chars / 4
        const estimatedTokens = Math.ceil((prompt.length + response.length) / 4);

        await AiStatsService.recordTrace({
            model: provider,
            latency: duration,
            tokens: estimatedTokens,
            success: true,
            stepName
        });

        return response;
    } catch (error) {
        const duration = (Date.now() - startTime) / 1000;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error(`[LLM Router] Execution failed for ${provider}`, { error: errorMessage });

        await AiStatsService.recordTrace({
            model: provider,
            latency: duration,
            tokens: 0,
            success: false,
            stepName
        });

        throw error;
    }
}
