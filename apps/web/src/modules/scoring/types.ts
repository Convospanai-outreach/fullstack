/**
 * Lead Scoring Module - Type Definitions
 * 
 * Provides comprehensive type definitions for the weighted scoring algorithm,
 * predictive analytics, verification agent, and model explainability features.
 */

// =============================================================================
// SCORING WEIGHTS & CONFIGURATION
// =============================================================================

export interface ScoringWeights {
    dwellTime: number;      // Weight for website dwell time (default: 0.4)
    emailClicks: number;    // Weight for email engagement (default: 0.35)
    socialMentions: number; // Weight for social signals (default: 0.25)
}

export interface ScoringConfig {
    weights: ScoringWeights;
    normalization: {
        dwellTimeMax: number;     // Max dwell time for normalization (default: 20 minutes)
        emailClicksMax: number;   // Max clicks for normalization (default: 20)
        socialMentionsMax: number; // Max mentions for normalization (default: 10)
    };
    thresholds: {
        hot: number;   // >= this score = HOT tier (default: 0.7)
        warm: number;  // >= this score = WARM tier (default: 0.4)
    };
}

// =============================================================================
// LEAD INTENT SCORING
// =============================================================================

export type LeadTier = 'HOT' | 'WARM' | 'COLD';
export type DataConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ScoreFactor {
    name: string;
    rawValue: number;
    normalizedValue: number;
    weight: number;
    contribution: number;
    explanation: string;
}

export interface CaseStudyMatch {
    id: string;
    title: string;
    similarity: number;
    relevantMetric: string;
}

export interface DataQuality {
    completeness: number;   // 0.0-1.0: How much data was available
    recency: number;        // 0.0-1.0: How recent is the engagement data
    confidenceLevel: DataConfidence;
}

export interface LeadIntentScore {
    score: number;           // 0.0 - 1.0 normalized score
    tier: LeadTier;
    breakdown: {
        dwellTimeContribution: number;
        emailClicksContribution: number;
        socialMentionsContribution: number;
    };
    confidence: number;      // 0.0 - 1.0 data confidence level
}

export interface ScoreExplanation {
    leadId: string;
    finalScore: number;
    tier: LeadTier;
    summary: string;         // Human-readable summary
    factors: ScoreFactor[];
    caseStudyMatch?: CaseStudyMatch;
    dataQuality: DataQuality;
    scoredAt: Date;
}

export interface BatchScoreResult {
    totalProcessed: number;
    successful: number;
    failed: number;
    averageScore: number;
    tierDistribution: {
        hot: number;
        warm: number;
        cold: number;
    };
    errors: Array<{ leadId: string; error: string }>;
}

// =============================================================================
// PREDICTIVE ANALYTICS
// =============================================================================

export interface ChurnPrediction {
    leadId: string;
    churnProbability: number;  // 0.0 - 1.0
    riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
    riskFactors: string[];
    recommendedActions: string[];
    predictedAt: Date;
}

export interface OptimalSendTime {
    leadId: string;
    optimalHour: number;       // 0-23
    optimalDay: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
    confidence: number;
    historicalOpenPattern: number[]; // 24 hourly buckets
    predictedAt: Date;
}

export type ClusterLabel = 'HIGH_VALUE' | 'AT_RISK' | 'NEW' | 'DORMANT';

export interface CustomerCluster {
    label: ClusterLabel;
    centroid: number[];
    memberCount: number;
    characteristics: string[];
    averageValue: number;
}

export interface ClusterAssignment {
    leadId: string;
    clusterLabel: ClusterLabel;
    distance: number;         // Distance from cluster centroid
    confidence: number;
}

// =============================================================================
// VERIFICATION AGENT
// =============================================================================

export type VerificationViolationType = 'LOW_SCORE' | 'MISSING_DATA' | 'ANOMALY' | 'BLACKLIST' | 'NO_CONSENT';
export type ViolationSeverity = 'WARNING' | 'ERROR';
export type VerificationRecommendation = 'PROCESS' | 'REVIEW' | 'REJECT';

export interface VerificationViolation {
    type: VerificationViolationType;
    severity: ViolationSeverity;
    message: string;
    field?: string;
}

export interface VerificationResult {
    leadId: string;
    passed: boolean;
    score: number;
    threshold: number;
    violations: VerificationViolation[];
    recommendation: VerificationRecommendation;
    explanation?: ScoreExplanation | undefined;
    verifiedAt: Date;
}

export interface BatchVerificationStats {
    total: number;
    passed: number;
    failed: number;
    reviewRequired: number;
    passRate: number;
    averageScore: number;
    commonViolations: Array<{ type: VerificationViolationType; count: number }>;
}

export interface BatchVerificationResult {
    passed: VerificationResult[];
    failed: VerificationResult[];
    stats: BatchVerificationStats;
}

// =============================================================================
// CASE STUDY RAG
// =============================================================================

export interface CaseStudyInput {
    title: string;
    industry: string;
    summary: string;
    content: string;
    metrics?: {
        conversionRate?: number;
        roi?: number;
        timeToClose?: number;
        [key: string]: number | undefined;
    };
}

export interface CaseStudyResult {
    id: string;
    title: string;
    industry: string;
    summary: string;
    metrics: Record<string, number>;
    similarity: number;
}

export interface RAGEnhancedCopy {
    copy: string;
    usedCaseStudies: CaseStudyResult[];
    confidence: number;
    groundedClaims: string[];
}

// =============================================================================
// DPDP ACT 2023 COMPLIANCE
// =============================================================================

export interface ComplianceEvent {
    type: 'CONSENT_CHECK' | 'DATA_ACCESS' | 'DATA_PURGE' | 'SCORING' | 'VERIFICATION';
    leadId: string;
    teamId: string;
    actorId?: string;
    outcome: 'ALLOWED' | 'BLOCKED' | 'LOGGED';
    reason: string;
    timestamp: Date;
}

export interface PurgeResult {
    leadId: string;
    success: boolean;
    purgedItems: {
        scoringData: boolean;
        verificationLogs: boolean;
        caseStudyMatches: boolean;
    };
    timestamp: Date;
}

export interface SanitizedLeadInput {
    id: string;
    dwellTimeMinutes: number;
    emailClicks: number;
    socialMentions: number;
    hasConsent: boolean;
    // PII fields are excluded
}
