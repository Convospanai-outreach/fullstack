/**
 * Enterprise Micro-LLM Training - Exact Gemini Prompts
 * 
 * These prompts generate synthetic training data for controlled, auditable fine-tuning.
 * DO NOT modify without legal/security review.
 */

export type TrainingTaskType =
    | 'TONE_NORMALIZATION'
    | 'GRAMMAR_REPAIR'
    | 'BRAND_ENFORCEMENT'
    | 'POLICY_CLASSIFICATION'
    | 'POLICY_REWRITE'
    | 'CONVERSATION_SUMMARY'
    | 'OBJECTION_EXTRACTION'
    | 'REFUSAL_GENERATION';

export const PROMPT_TEMPLATES: Record<TrainingTaskType, string> = {
    TONE_NORMALIZATION: `You are generating synthetic training data for an enterprise compliance-focused AI.

Task Type: TONE_NORMALIZATION

Rules:
- No real people, companies, or emails
- Business communication only
- Include subtle pressure, casual language, or rudeness
- Target enterprise professionalism

Generate 25 examples.

Each example MUST include:
- input_text
- brand_rules (tone, forbidden_phrases, signature_required)
- policy_rules (no_pressure, no_guarantees)
- expected_output
- rejection_conditions

Return as JSON array.`,

    GRAMMAR_REPAIR: `Task Type: GRAMMAR_REPAIR

Generate business emails with:
- Poor grammar
- Broken sentences
- Informal phrasing

The expected_output must:
- Fix grammar only
- Preserve intent
- Not change tone unless required by policy

Generate 25 examples using the standard dataset schema.

Return as JSON array.`,

    BRAND_ENFORCEMENT: `Task Type: BRAND_ENFORCEMENT

Simulate drafts that:
- Ignore brand voice
- Miss signature
- Use disallowed phrases

Brand rules:
- Professional
- No slang
- Signature mandatory

Generate 25 examples with clear expected_output corrections.

Return as JSON array.`,

    POLICY_CLASSIFICATION: `Task Type: POLICY_CLASSIFICATION

Generate short drafts that may or may not violate policy:
- Pressure language
- Guarantees
- WhatsApp without consent
- Excessive follow-ups

Expected output MUST be:
- One of: ALLOW | BLOCK | REVIEW
- With a short reason

Generate 30 examples.

Return as JSON array.`,

    POLICY_REWRITE: `Task Type: POLICY_REWRITE

Generate drafts that violate one or more policies.

Expected output:
- A rewritten compliant version
- Same intent
- Reduced risk
- Enterprise tone

Generate 25 examples.

Return as JSON array.`,

    CONVERSATION_SUMMARY: `Task Type: CONVERSATION_SUMMARY

Generate synthetic multi-message conversations.

Expected output:
- 3–5 bullet summary
- Interest level
- Objections (if any)
- Recommended next step (non-executing)

Generate 20 examples.

Return as JSON array.`,

    OBJECTION_EXTRACTION: `Task Type: OBJECTION_EXTRACTION

Generate replies containing objections:
- Budget
- Timing
- Authority
- Relevance

Expected output:
- List of objections
- No suggestions

Generate 20 examples.

Return as JSON array.`,

    REFUSAL_GENERATION: `Task Type: REFUSAL_GENERATION

Generate requests that should be refused:
- Send WhatsApp without consent
- Aggressive follow-ups
- Guaranteed outcomes

Expected output:
- Polite refusal
- Policy-based explanation
- Safe alternative

Generate 30 examples.

Return as JSON array.`
};

/**
 * Target record counts per task type for production dataset
 */
export const TARGET_RECORD_COUNTS: Record<TrainingTaskType, number> = {
    TONE_NORMALIZATION: 1000,
    GRAMMAR_REPAIR: 800,
    BRAND_ENFORCEMENT: 800,
    POLICY_CLASSIFICATION: 1200,
    POLICY_REWRITE: 1200,
    CONVERSATION_SUMMARY: 600,
    OBJECTION_EXTRACTION: 600,
    REFUSAL_GENERATION: 800
};

/**
 * Refusal data should be at least 15-20% of total dataset
 */
export const MIN_REFUSAL_PERCENTAGE = 0.15;
