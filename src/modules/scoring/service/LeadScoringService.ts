/**
 * Lead Scoring Service
 * 
 * Implements a weighted scoring algorithm that combines:
 * - Website dwell time (40% weight)
 * - Email clicks (35% weight)
 * - Social media mentions (25% weight)
 * 
 * Features:
 * - Sigmoid-like normalization for smooth scoring
 * - Explainable factor-by-factor breakdown
 * - DPDP Act 2023 compliance with consent checking
 * - Case study matching for enhanced scoring context
 */

import { prisma } from "@/lib/db";
import type {
    ScoringWeights,
    ScoringConfig,
    LeadIntentScore,
    LeadTier,
    ScoreExplanation,
    ScoreFactor,
    BatchScoreResult,
    DataQuality,
    DataConfidence,
    SanitizedLeadInput,
    ComplianceEvent
} from "../types";

const DEFAULT_CONFIG: ScoringConfig = {
    weights: {
        dwellTime: 0.4,
        emailClicks: 0.35,
        socialMentions: 0.25
    },
    normalization: {
        dwellTimeMax: 20,      // 20 minutes
        emailClicksMax: 20,    // 20 clicks
        socialMentionsMax: 10  // 10 mentions
    },
    thresholds: {
        hot: 0.7,
        warm: 0.4
    }
};

export class LeadScoringService {
    private config: ScoringConfig;

    constructor(config?: Partial<ScoringConfig>) {
        this.config = {
            ...DEFAULT_CONFIG,
            ...config,
            weights: { ...DEFAULT_CONFIG.weights, ...config?.weights },
            normalization: { ...DEFAULT_CONFIG.normalization, ...config?.normalization },
            thresholds: { ...DEFAULT_CONFIG.thresholds, ...config?.thresholds }
        };
    }

    /**
     * Normalize a value using exponential decay (sigmoid-like).
     * Formula: 1 - e^(-x/k) where k is the scaling factor.
     * This produces a smooth curve from 0 to 1.
     */
    private normalize(value: number, max: number): number {
        if (value <= 0) return 0;
        const k = max / 3; // At max value, we get ~0.95
        return 1 - Math.exp(-value / k);
    }

    /**
     * Determine the tier based on score thresholds.
     */
    private getTier(score: number): LeadTier {
        if (score >= this.config.thresholds.hot) return 'HOT';
        if (score >= this.config.thresholds.warm) return 'WARM';
        return 'COLD';
    }

    /**
     * Generate human-readable explanation for a factor.
     */
    private generateFactorExplanation(
        name: string,
        rawValue: number,
        normalizedValue: number,
        percentile?: number
    ): string {
        const levelDescriptor = normalizedValue >= 0.7 ? 'high' : normalizedValue >= 0.4 ? 'moderate' : 'low';
        const percentileStr = percentile ? ` (top ${Math.round((1 - percentile) * 100)}% of leads)` : '';

        switch (name) {
            case 'Website Dwell Time':
                return `${rawValue.toFixed(1)} minutes on site indicates ${levelDescriptor} interest${percentileStr}`;
            case 'Email Clicks':
                return `${rawValue} email clicks shows ${levelDescriptor} engagement with content${percentileStr}`;
            case 'Social Mentions':
                return `${rawValue} social mentions indicate ${levelDescriptor} brand awareness${percentileStr}`;
            default:
                return `${name}: ${rawValue} (${levelDescriptor})`;
        }
    }

    /**
     * Calculate composite intent score with full breakdown.
     */
    calculateIntentScore(input: {
        dwellTimeMinutes: number;
        emailClicks: number;
        socialMentions: number;
    }): LeadIntentScore {
        const { weights, normalization } = this.config;

        // Normalize each factor
        const normalizedDwell = this.normalize(input.dwellTimeMinutes, normalization.dwellTimeMax);
        const normalizedClicks = this.normalize(input.emailClicks, normalization.emailClicksMax);
        const normalizedSocial = this.normalize(input.socialMentions, normalization.socialMentionsMax);

        // Calculate weighted contributions
        const dwellContribution = normalizedDwell * weights.dwellTime;
        const clicksContribution = normalizedClicks * weights.emailClicks;
        const socialContribution = normalizedSocial * weights.socialMentions;

        // Final composite score
        const score = dwellContribution + clicksContribution + socialContribution;

        // Calculate data confidence based on data availability
        const dataPoints = [input.dwellTimeMinutes, input.emailClicks, input.socialMentions];
        const nonZeroCount = dataPoints.filter(v => v > 0).length;
        const confidence = nonZeroCount / dataPoints.length;

        return {
            score: Math.round(score * 100) / 100, // Round to 2 decimal places
            tier: this.getTier(score),
            breakdown: {
                dwellTimeContribution: Math.round(dwellContribution * 100) / 100,
                emailClicksContribution: Math.round(clicksContribution * 100) / 100,
                socialMentionsContribution: Math.round(socialContribution * 100) / 100
            },
            confidence
        };
    }

    /**
     * Generate full explainable score with all factors.
     */
    generateExplanation(
        leadId: string,
        input: {
            dwellTimeMinutes: number;
            emailClicks: number;
            socialMentions: number;
        }
    ): ScoreExplanation {
        const intentScore = this.calculateIntentScore(input);
        const { weights, normalization } = this.config;

        // Normalize values
        const normalizedDwell = this.normalize(input.dwellTimeMinutes, normalization.dwellTimeMax);
        const normalizedClicks = this.normalize(input.emailClicks, normalization.emailClicksMax);
        const normalizedSocial = this.normalize(input.socialMentions, normalization.socialMentionsMax);

        // Build factor array
        const factors: ScoreFactor[] = [
            {
                name: 'Website Dwell Time',
                rawValue: input.dwellTimeMinutes,
                normalizedValue: Math.round(normalizedDwell * 100) / 100,
                weight: weights.dwellTime,
                contribution: intentScore.breakdown.dwellTimeContribution,
                explanation: this.generateFactorExplanation('Website Dwell Time', input.dwellTimeMinutes, normalizedDwell)
            },
            {
                name: 'Email Clicks',
                rawValue: input.emailClicks,
                normalizedValue: Math.round(normalizedClicks * 100) / 100,
                weight: weights.emailClicks,
                contribution: intentScore.breakdown.emailClicksContribution,
                explanation: this.generateFactorExplanation('Email Clicks', input.emailClicks, normalizedClicks)
            },
            {
                name: 'Social Mentions',
                rawValue: input.socialMentions,
                normalizedValue: Math.round(normalizedSocial * 100) / 100,
                weight: weights.socialMentions,
                contribution: intentScore.breakdown.socialMentionsContribution,
                explanation: this.generateFactorExplanation('Social Mentions', input.socialMentions, normalizedSocial)
            }
        ];

        // Sort by contribution (highest first)
        factors.sort((a, b) => b.contribution - a.contribution);

        // Generate human-readable summary
        const topFactors = factors
            .filter(f => f.contribution > 0.1)
            .map(f => {
                if (f.name === 'Website Dwell Time') return `High dwell time (${f.rawValue}min)`;
                if (f.name === 'Email Clicks') return `Strong email engagement (${f.rawValue} clicks)`;
                if (f.name === 'Social Mentions') return `${f.rawValue} social mentions`;
                return f.name;
            });

        const summary = `Score ${intentScore.score.toFixed(2)}: ${topFactors.join(' + ') || 'Limited engagement data'}`;

        // Data quality assessment
        const dataQuality: DataQuality = {
            completeness: intentScore.confidence,
            recency: 1.0, // Would need lastUpdatedAt to calculate properly
            confidenceLevel: this.getConfidenceLevel(intentScore.confidence)
        };

        return {
            leadId,
            finalScore: intentScore.score,
            tier: intentScore.tier,
            summary,
            factors,
            dataQuality,
            scoredAt: new Date()
        };
    }

    private getConfidenceLevel(confidence: number): DataConfidence {
        if (confidence >= 0.8) return 'HIGH';
        if (confidence >= 0.5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Sanitize lead data for DPDP compliance - remove PII.
     */
    sanitizeLeadData(lead: any): SanitizedLeadInput {
        return {
            id: lead.id,
            dwellTimeMinutes: lead.dwellTimeMinutes || 0,
            emailClicks: lead.emailClicks || 0,
            socialMentions: lead.socialMentions || 0,
            hasConsent: lead.consentObtained ?? false
        };
    }

    /**
     * Log a compliance event for audit purposes.
     */
    private async logComplianceEvent(event: ComplianceEvent): Promise<void> {
        console.log(`[DPDP Compliance] ${event.type}: Lead ${event.leadId} - ${event.outcome} - ${event.reason}`);
        // In production, persist to AuditLog table
    }

    /**
     * Score a lead and persist the result.
     * Includes DPDP compliance checks.
     */
    async scoreAndPersist(leadId: string): Promise<ScoreExplanation> {
        // Fetch lead data
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                teamId: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                consentObtained: true
            }
        });

        if (!lead) {
            throw new Error(`Lead not found: ${leadId}`);
        }

        // DPDP Compliance: Check consent
        if (!lead.consentObtained) {
            await this.logComplianceEvent({
                type: 'SCORING',
                leadId,
                teamId: lead.teamId || 'unknown',
                outcome: 'BLOCKED',
                reason: 'Consent not obtained - DPDP Act 2023 compliance',
                timestamp: new Date()
            });
            throw new Error(`DPDP_COMPLIANCE: Cannot score lead without consent`);
        }

        // Sanitize and score
        const sanitized = this.sanitizeLeadData(lead);
        const explanation = this.generateExplanation(leadId, sanitized);

        // Persist score
        await prisma.lead.update({
            where: { id: leadId },
            data: {
                intentScore: explanation.finalScore,
                clusterLabel: explanation.tier, // Use tier as initial cluster
                lastScoredAt: new Date()
            }
        });

        // Log successful scoring
        await this.logComplianceEvent({
            type: 'SCORING',
            leadId,
            teamId: lead.teamId || 'unknown',
            outcome: 'ALLOWED',
            reason: `Score calculated: ${explanation.finalScore.toFixed(2)} (${explanation.tier})`,
            timestamp: new Date()
        });

        return explanation;
    }

    /**
     * Batch score all leads for a team.
     */
    async batchScoreLeads(teamId: string): Promise<BatchScoreResult> {
        const leads = await prisma.lead.findMany({
            where: {
                teamId,
                consentObtained: true // Only score consented leads
            },
            select: {
                id: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true
            }
        });

        const results: BatchScoreResult = {
            totalProcessed: leads.length,
            successful: 0,
            failed: 0,
            averageScore: 0,
            tierDistribution: { hot: 0, warm: 0, cold: 0 },
            errors: []
        };

        let scoreSum = 0;

        for (const lead of leads) {
            try {
                const sanitized = this.sanitizeLeadData(lead);
                const score = this.calculateIntentScore(sanitized);

                await prisma.lead.update({
                    where: { id: lead.id },
                    data: {
                        intentScore: score.score,
                        lastScoredAt: new Date()
                    }
                });

                scoreSum += score.score;
                results.successful++;
                results.tierDistribution[score.tier.toLowerCase() as 'hot' | 'warm' | 'cold']++;
            } catch (error: any) {
                results.failed++;
                results.errors.push({ leadId: lead.id, error: error.message });
            }
        }

        results.averageScore = results.successful > 0 ? scoreSum / results.successful : 0;

        return results;
    }

    /**
     * Update scoring weights configuration.
     */
    updateWeights(weights: Partial<ScoringWeights>): void {
        // Validate weights sum to 1.0
        const newWeights = { ...this.config.weights, ...weights };
        const sum = newWeights.dwellTime + newWeights.emailClicks + newWeights.socialMentions;

        if (Math.abs(sum - 1.0) > 0.01) {
            throw new Error(`Weights must sum to 1.0, got ${sum}`);
        }

        this.config.weights = newWeights;
    }

    /**
     * Get current scoring configuration.
     */
    getConfig(): ScoringConfig {
        return { ...this.config };
    }
}

// Singleton instance
export const leadScoringService = new LeadScoringService();
