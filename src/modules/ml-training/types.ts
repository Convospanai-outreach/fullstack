/**
 * Enterprise Micro-LLM Training - Type Definitions
 * 
 * Schema enforcement for synthetic training data.
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

export interface BrandRules {
    tone: string;
    forbidden_phrases: string[];
    signature_required: boolean;
}

export interface PolicyRules {
    no_pressure: boolean;
    no_guarantees: boolean;
    whatsapp_requires_consent?: boolean;
    max_followups?: number;
}

export interface TrainingRecordSchema {
    task_type: TrainingTaskType;
    input_text: string;
    brand_rules: BrandRules;
    policy_rules: PolicyRules;
    expected_output: string;
    rejection_conditions: string[];
}

/**
 * 5-Point Review Rubric
 */
export interface ReviewScore {
    policy_correctness: number; // 1-5
    tone_quality: number;       // 1-5
    clarity: number;            // 1-5
    realism: number;            // 1-5
    refusal_quality?: number;   // 1-5 (if applicable)
}

export interface DatasetReviewSubmission {
    datasetId: string;
    reviewerId: string;
    sampleSize: number;
    scores: ReviewScore;
    notes?: string;
    approved: boolean;
}

/**
 * Model Evaluation Metrics
 */
export interface EvaluationMetrics {
    refusal_accuracy: number;        // Target: ≥95%
    policy_violation_rate: number;   // Target: <1%
    drift_score: number;              // Consistency check
    verbosity_score: number;          // Output length inflation
}

export const METRIC_THRESHOLDS = {
    REFUSAL_ACCURACY: 0.95,
    POLICY_VIOLATION_RATE: 0.01,
    DRIFT_TOLERANCE: 0.10,
    VERBOSITY_MAX: 1.5
} as const;
