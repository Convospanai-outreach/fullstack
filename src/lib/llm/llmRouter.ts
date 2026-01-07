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
                // OpenAI integration requires 'openai' package installation
                // Install with: npm install openai
                // Add OPENAI_API_KEY to your .env file
                logger.warn("[LLM Router] ⚠️  GPT-4 requested but OpenAI SDK not configured. Falling back to Gemini.");
                console.warn("⚠️  To use GPT-4: npm install openai && add OPENAI_API_KEY to .env");
                response = await generateWithGemini(prompt);
                break;

            case 'claude':
            case 'claude-3-opus':
                // Anthropic integration requires '@anthropic-ai/sdk' package installation
                // Install with: npm install @anthropic-ai/sdk
                // Add ANTHROPIC_API_KEY to your .env file
                logger.warn("[LLM Router] ⚠️  Claude requested but Anthropic SDK not configured. Falling back to Gemini.");
                console.warn("⚠️  To use Claude: npm install @anthropic-ai/sdk && add ANTHROPIC_API_KEY to .env");
                response = await generateWithGemini(prompt);
                break;

            case 'local':
                // Local inference requires Ollama or similar local LLM server
                // Setup: https://ollama.ai/
                logger.warn("[LLM Router] ⚠️  Local LLM requested but no local server configured. Falling back to Gemini.");
                console.warn("⚠️  To use local LLMs: Install Ollama from https://ollama.ai/");
                response = await generateWithGemini(prompt);
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
