
import { LLMProvider, TaskComplexity, ModelRequest, ModelResponse, LLMError } from "./types.js";
import { providerRegistry } from "./LLMProviderRegistry.js";
import { logger } from "../../utils/logger.js";

/**
 * Backend ModelGateway.
 * 
 * Simplified for the standalone API service. 
 * Heavy features like SemanticCache and ExperimentService are bypassed or mocked 
 * to minimize dependencies for the initial migration.
 */
export class ModelGateway {
    async generate(request: ModelRequest): Promise<string> {
        if (!request.teamId) {
            logger.error("[Gateway] REJECTED: Missing teamId");
            throw new Error("Security Violation: AI request missing team context.");
        }

        const complexity = request.complexity || TaskComplexity.ROUTINE;
        const preferredProvider = this.selectPreferredProvider(complexity);
        const fallbackChain = providerRegistry.getFallbackChain(preferredProvider);

        if (fallbackChain.length === 0) {
            throw new Error("No LLM providers available in Backend.");
        }

        let lastError: Error | null = null;

        for (const providerName of fallbackChain) {
            try {
                logger.info(`[Gateway] Attempting ${providerName}`);
                const provider = providerRegistry.getProvider(providerName);
                if (!provider) continue;

                const response = await provider.generate(request);
                
                logger.info(`[Gateway] Success: ${providerName} | ${response.model}`);
                return response.content;
            } catch (error: any) {
                lastError = error;
                logger.warn(`[Gateway] ${providerName} failed: ${error.message}`);
            }
        }

        throw new Error(`All backend LLM providers failed. Last error: ${lastError?.message}`);
    }

    private selectPreferredProvider(complexity: TaskComplexity): LLMProvider {
        // Prefer Groq for routine, Gemini/Anthropic for strategic
        if (complexity === TaskComplexity.STRATEGIC) {
            return LLMProvider.GEMINI;
        }
        return LLMProvider.GROQ;
    }
}

export const modelGateway = new ModelGateway();
