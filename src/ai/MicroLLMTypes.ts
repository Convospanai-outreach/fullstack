
/**
 * Stage 0/1: Strict Task Taxonomy
 * These are the ONLY tasks the Micro-LLM is allowed to perform.
 */
export type MicroLLMTaskType =
    | "TONE_NORMALIZATION"
    | "GRAMMAR_REPAIR"
    | "BRAND_ENFORCEMENT"
    | "POLICY_CLASSIFICATION"
    | "POLICY_REWRITE"
    | "CONVERSATION_SUMMARY"
    | "OBJECTION_EXTRACTION"
    | "REFUSAL_GENERATION";

/**
 * Stage 0: Strict Request Schema
 */
export interface MicroLLMRequest {
    taskType: MicroLLMTaskType;
    inputText: string;

    // Contextual Rules (Optional but strict schema if present)
    brandRules?: {
        tone?: string;
        forbiddenPhrases?: string[];
        signatureRequired?: boolean;
        [key: string]: any;
    };

    policyRules?: {
        noPressure?: boolean;
        noGuarantees?: boolean;
        whatsappConsent?: boolean;
        [key: string]: any;
    };
}

/**
 * Stage 0: Strict Response Schema
 */
export interface MicroLLMResponse {
    outputText?: string; // For rewrite/generation tasks
    classification?: "ALLOW" | "BLOCK" | "REVIEW"; // For classification tasks
    refusalReason?: string; // If refused
    confidence: number; // 0.0 to 1.0
    latencyMs: number;
}
