
import { 
    OpenAIProvider, 
    GeminiProvider, 
    GroqProvider, 
    AnthropicProvider, 
    OllamaProvider 
} from "./providers/index.js";
import { LLMProvider, ProviderHealth } from "./types.js";
import { BaseProvider } from "./providers/BaseProvider.js";

export class LLMProviderRegistry {
    private providers: Map<LLMProvider, BaseProvider> = new Map();
    private healthStatus: Map<LLMProvider, ProviderHealth> = new Map();

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders() {
        if (process.env['OPENAI_API_KEY']) {
            this.providers.set(LLMProvider.OPENAI, new OpenAIProvider(process.env['OPENAI_API_KEY']!));
        }
        if (process.env['GEMINI_API_KEY']) {
            this.providers.set(LLMProvider.GEMINI, new GeminiProvider(process.env['GEMINI_API_KEY']!));
        }
        if (process.env['GROQ_API_KEY']) {
            this.providers.set(LLMProvider.GROQ, new GroqProvider(process.env['GROQ_API_KEY']!));
        }
        if (process.env['ANTHROPIC_API_KEY']) {
            this.providers.set(LLMProvider.ANTHROPIC, new AnthropicProvider(process.env['ANTHROPIC_API_KEY']!));
        }
        // Ollama as fallback
        this.providers.set(LLMProvider.OLLAMA, new OllamaProvider(process.env['OLLAMA_BASE_URL'] || "http://localhost:11434"));
    }

    getProvider(provider: LLMProvider): BaseProvider | undefined {
        return this.providers.get(provider);
    }

    getFallbackChain(preferredProvider?: LLMProvider): LLMProvider[] {
        const healthy = Array.from(this.providers.keys());
        if (!preferredProvider) return healthy;
        
        return [preferredProvider, ...healthy.filter(p => p !== preferredProvider)];
    }

    getHealthStatus() { return this.healthStatus; }
    recordSuccess(p: any, l: any) {}
    recordFailure(p: any, e: any) {}
}

export const providerRegistry = new LLMProviderRegistry();
