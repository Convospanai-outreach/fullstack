import { generateWithGemini } from "@/ai/gemini";
import { SovereignFirewall } from "@/modules/governance/SovereignFirewall";
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
stepName = "Direct Request"
}: LLMOptions): Promise < string > {
    return retryWithBackoff(async () => {
        return executeRunLLM({ provider, prompt, temperature: _temperature, stepName });
    }, 3, provider, prompt);
}

async function executeRunLLM({
    provider,
    prompt,
    temperature: _temperature,
    stepName
}: { provider: string, prompt: string, temperature: number, stepName: string }): Promise<string> {

    // SOVEREIGN FIREWALL: Redact PII before leaving the network boundary
    const safePrompt = await SovereignFirewall.processOutbound(prompt, `LLM:${provider}`);

    logger.info(`[LLM Router] Routing request to ${provider}`, { provider, promptLength: safePrompt.length, originalLength: prompt.length });
    const startTime = Date.now();

    // Auto-fallback logic for specific providers if they consistently fail
    // This is handled via the retry wrapper catch, but we can also do smart routing here if needed

    try {
        let response = "";
        switch (provider) {
            case 'gemini':
            case 'gemini-1.5-pro':
            case 'gemini-1.5-flash':
                response = await generateWithGemini(safePrompt, provider === 'gemini' ? 'gemini-1.5-pro' : provider);
                break;

            case 'gpt4':
            case 'gpt-4o':
                // OpenAI integration requires 'openai' package installation
                // Install with: npm install openai
                // Add OPENAI_API_KEY to your .env file
                logger.warn("[LLM Router] ⚠️  GPT-4 requested but OpenAI SDK not configured. Falling back to Gemini.");
                console.warn("⚠️  To use GPT-4: npm install openai && add OPENAI_API_KEY to .env");
                response = await generateWithGemini(safePrompt);
                break;

            case 'claude':
            case 'claude-3-opus':
                // Anthropic integration requires '@anthropic-ai/sdk' package installation
                // Install with: npm install @anthropic-ai/sdk
                // Add ANTHROPIC_API_KEY to your .env file
                logger.warn("[LLM Router] ⚠️  Claude requested but Anthropic SDK not configured. Falling back to Gemini.");
                console.warn("⚠️  To use Claude: npm install @anthropic-ai/sdk && add ANTHROPIC_API_KEY to .env");
                response = await generateWithGemini(safePrompt);
                break;

            case 'local':
                // Local inference requires Ollama or similar local LLM server
                // Setup: https://ollama.ai/
                logger.warn("[LLM Router] ⚠️  Local LLM requested but no local server configured. Falling back to Gemini.");
                console.warn("⚠️  To use local LLMs: Install Ollama from https://ollama.ai/");
                response = await generateWithGemini(safePrompt);
                break;

            default:
                logger.error(`[LLM Router] Unsupported provider requested: ${provider}`);
                throw new Error(`Unsupported LLM provider: ${provider}`);
        }

        const duration = (Date.now() - startTime) / 1000;
        // Simple token estimation: chars / 4
        const estimatedTokens = Math.ceil((safePrompt.length + response.length) / 4);

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

/**
 * Retries an operation with exponential backoff
 * If it fails after maxRetries, it attempts a fallback for known high-tier models
 */
async function retryWithBackoff(
    operation: () => Promise<string>,
    maxRetries: number = 3,
    originalProvider: string,
    prompt: string
): Promise<string> {
    let currentTry = 0;

    while (true) {
        try {
            return await operation();
        } catch (error: any) {
            currentTry++;

            // Check if we should stop retrying immediately (e.g. invalid API key)
            const isFatal = error.message.includes("API key") || error.message.includes("unauthorized");

            if (currentTry >= maxRetries || isFatal) {
                logger.error(`[LLM Router] Failed after ${currentTry} attempts.`, { error: error.message });

                // Runtime Fallback Logic
                if (['gpt4', 'gpt-4o', 'claude', 'claude-3-opus'].includes(originalProvider)) {
                    logger.warn(`[LLM Router] 🔄 Auto-falling back from ${originalProvider} to Gemini Pro`);
                    try {
                        // Fallback to a stable, cheaper model
                        return await generateWithGemini(prompt, 'gemini-1.5-pro');
                    } catch (fallbackError) {
                        logger.error("[LLM Router] Critical: Fallback also failed.", { fallbackError });
                        throw error; // Throw original error
                    }
                }

                throw error;
            }

            const delay = Math.pow(2, currentTry) * 1000; // 2s, 4s, 8s
            logger.warn(`[LLM Router] Attempt ${currentTry} failed. Retrying in ${delay}ms...`, { error: error.message });
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

