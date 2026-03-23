/**
 * LLM Provider Types and Interfaces
 */

export enum LLMProvider {
    OPENAI = "openai",
    ANTHROPIC = "anthropic",
    GEMINI = "gemini",
    GROQ = "groq",
    OLLAMA = "ollama"
}

export enum TaskComplexity {
    ROUTINE = "ROUTINE",    // Extraction, Classification, Simple Drafting
    STRATEGIC = "STRATEGIC" // Creative Drafting, Complex Reasoning, Strategy
}

export interface ModelRequest {
    prompt: string;
    complexity?: TaskComplexity;
    context?: any;
    maxTokens?: number;
    temperature?: number;
    teamId?: string; // For usage tracking
    model?: string;  // Specific model override (e.g. from HybridRouter)
}

export interface ModelResponse {
    content: string;
    provider: LLMProvider;
    model: string;
    tokensIn: number;
    tokensOut: number;
    latency: number;
    cost: number;
    cached?: boolean;
}

export interface ProviderConfig {
    name: LLMProvider;
    apiKey: string;
    models: {
        routine: string;
        strategic: string;
    };
    costPerMillionTokensIn: number;
    costPerMillionTokensOut: number;
    maxRetries: number;
    timeout: number;
    enabled: boolean;
    priority: number; // Lower = higher priority
}

export interface ProviderHealth {
    provider: LLMProvider;
    isHealthy: boolean;
    lastCheck: Date;
    latency: number;
    errorRate: number;
    consecutiveFailures: number;
}

export class LLMError extends Error {
    constructor(
        message: string,
        public provider: LLMProvider,
        public statusCode?: number,
        public retryable: boolean = true
    ) {
        super(message);
        this.name = 'LLMError';
    }
}
