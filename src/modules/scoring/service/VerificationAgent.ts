/**
 * Verification Agent (Antigravity Pattern)
 * 
 * Quality assurance agent that validates leads against scoring thresholds.
 * Ensures only high-quality data is processed in the marketing pipeline.
 * 
 * Features:
 * - DPDP Act 2023 compliance (consent checks, audit trails)
 * - Configurable scoring thresholds
 * - Explainable verification decisions
 * - Workflow engine integration
 */

import { prisma } from "@/lib/db";
import { LeadScoringService, leadScoringService } from "./LeadScoringService";
import type {
    VerificationResult,
    VerificationViolation,
    VerificationRecommendation,
    BatchVerificationResult,
    BatchVerificationStats,
    ScoreExplanation,
    PurgeResult,
    ComplianceEvent
} from "../types";

export class VerificationAgent {
    private scoreThreshold: number;
    private requiredFields: string[];
    private scoringService: LeadScoringService;

    constructor(config?: { scoreThreshold?: number; requiredFields?: string[] }) {
        this.scoreThreshold = config?.scoreThreshold ?? 0.5;
        this.requiredFields = config?.requiredFields ?? ['email', 'company'];
        this.scoringService = leadScoringService;
    }

    /**
     * DPDP Compliance: Check if lead has valid consent.
     * @internal Used internally for consent verification
     */
    async hasConsent(leadId: string): Promise<boolean> {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { consentObtained: true }
        });
        return lead?.consentObtained ?? false;
    }

    /**
     * Run verification pipeline on a single lead.
     */
    async verify(leadId: string): Promise<VerificationResult> {
        const violations: VerificationViolation[] = [];
        let explanation: ScoreExplanation | undefined;

        // Fetch lead data
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                email: true,
                company: true,
                fullName: true,
                teamId: true,
                consentObtained: true,
                intentScore: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                status: true
            }
        });

        if (!lead) {
            return {
                leadId,
                passed: false,
                score: 0,
                threshold: this.scoreThreshold,
                violations: [{ type: 'MISSING_DATA', severity: 'ERROR', message: 'Lead not found' }],
                recommendation: 'REJECT',
                verifiedAt: new Date()
            };
        }

        // 1. DPDP Compliance: Check consent
        if (!lead.consentObtained) {
            violations.push({
                type: 'NO_CONSENT',
                severity: 'ERROR',
                message: 'DPDP Act 2023: Lead has not provided data processing consent'
            });

            await this.logComplianceEvent({
                type: 'VERIFICATION',
                leadId,
                teamId: lead.teamId || 'unknown',
                outcome: 'BLOCKED',
                reason: 'No consent obtained',
                timestamp: new Date()
            });
        }

        // 2. Check required fields
        for (const field of this.requiredFields) {
            const value = lead[field as keyof typeof lead];
            if (!value || (typeof value === 'string' && value.trim() === '')) {
                violations.push({
                    type: 'MISSING_DATA',
                    severity: 'WARNING',
                    message: `Missing required field: ${field}`,
                    field
                });
            }
        }

        // 3. Calculate or retrieve intent score
        let score = lead.intentScore ?? 0;

        if (lead.consentObtained && score === 0) {
            try {
                explanation = await this.scoringService.scoreAndPersist(leadId);
                score = explanation.finalScore;
            } catch (err: any) {
                violations.push({
                    type: 'ANOMALY',
                    severity: 'WARNING',
                    message: `Scoring failed: ${err.message}`
                });
            }
        } else if (lead.consentObtained) {
            // Generate explanation for existing score
            explanation = this.scoringService.generateExplanation(leadId, {
                dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
                emailClicks: lead.emailClicks ?? 0,
                socialMentions: lead.socialMentions ?? 0
            });
        }

        // 4. Check score threshold
        if (score < this.scoreThreshold) {
            violations.push({
                type: 'LOW_SCORE',
                severity: 'WARNING',
                message: `Intent score ${score.toFixed(2)} below threshold ${this.scoreThreshold}`
            });
        }

        // 5. Check for status anomalies
        if (lead.status === 'CLOSED_LOST') {
            violations.push({
                type: 'BLACKLIST',
                severity: 'ERROR',
                message: 'Lead is marked as CLOSED_LOST'
            });
        }

        // Determine recommendation
        const hasErrors = violations.some(v => v.severity === 'ERROR');
        const hasWarnings = violations.some(v => v.severity === 'WARNING');
        const passed = !hasErrors && score >= this.scoreThreshold;

        let recommendation: VerificationRecommendation;
        if (hasErrors) {
            recommendation = 'REJECT';
        } else if (hasWarnings || score < this.scoreThreshold * 1.2) {
            recommendation = 'REVIEW';
        } else {
            recommendation = 'PROCESS';
        }

        const result: VerificationResult = {
            leadId,
            passed,
            score,
            threshold: this.scoreThreshold,
            violations,
            recommendation,
            explanation,
            verifiedAt: new Date()
        };

        // Log verification result
        await this.logVerification(result, lead.teamId || 'unknown');

        return result;
    }

    /**
     * Batch verification for multiple leads.
     */
    async verifyBatch(leadIds: string[]): Promise<BatchVerificationResult> {
        const passed: VerificationResult[] = [];
        const failed: VerificationResult[] = [];
        const violationCounts: Record<string, number> = {};

        for (const leadId of leadIds) {
            const result = await this.verify(leadId);

            if (result.passed) {
                passed.push(result);
            } else {
                failed.push(result);
            }

            // Track violation counts
            for (const v of result.violations) {
                violationCounts[v.type] = (violationCounts[v.type] || 0) + 1;
            }
        }

        const total = leadIds.length;
        const avgScore = [...passed, ...failed].reduce((sum, r) => sum + r.score, 0) / total || 0;

        const stats: BatchVerificationStats = {
            total,
            passed: passed.length,
            failed: failed.length,
            reviewRequired: failed.filter(r => r.recommendation === 'REVIEW').length,
            passRate: total > 0 ? passed.length / total : 0,
            averageScore: Math.round(avgScore * 100) / 100,
            commonViolations: Object.entries(violationCounts)
                .map(([type, count]) => ({ type: type as any, count }))
                .sort((a, b) => b.count - a.count)
        };

        return { passed, failed, stats };
    }

    /**
     * Hook into workflow engine for automatic verification.
     * Adds a verification step to an existing workflow.
     */
    async integrateWithWorkflow(workflowId: string): Promise<void> {
        const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
            select: { nodes: true, edges: true }
        });

        if (!workflow) {
            throw new Error(`Workflow not found: ${workflowId}`);
        }

        // Add verification node to workflow
        const nodes = workflow.nodes as any[];
        const verificationNode = {
            id: `verify_${Date.now()}`,
            type: 'action',
            position: { x: 100, y: 200 },
            data: {
                label: 'Verify Lead',
                actionType: 'verify_lead',
                config: {
                    scoreThreshold: this.scoreThreshold,
                    requiredFields: this.requiredFields
                }
            }
        };

        nodes.push(verificationNode);

        await prisma.workflow.update({
            where: { id: workflowId },
            data: { nodes }
        });

        console.log(`[VerificationAgent] Added verification step to workflow ${workflowId}`);
    }

    /**
     * DPDP Act 2023: Purge all lead scoring data.
     * Implements Right to Erasure.
     */
    async purgeLeadData(leadId: string): Promise<PurgeResult> {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { teamId: true }
        });

        const purgedItems = {
            scoringData: false,
            verificationLogs: false,
            caseStudyMatches: false
        };

        try {
            // Clear scoring data from lead
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    intentScore: null,
                    dwellTimeMinutes: null,
                    emailClicks: null,
                    socialMentions: null,
                    lastScoredAt: null,
                    clusterLabel: null,
                    churnRisk: null,
                    optimalSendHour: null
                }
            });
            purgedItems.scoringData = true;

            // Delete verification logs
            await prisma.verificationLog.deleteMany({
                where: { leadId }
            });
            purgedItems.verificationLogs = true;

            // Log compliance event
            await this.logComplianceEvent({
                type: 'DATA_PURGE',
                leadId,
                teamId: lead?.teamId || 'unknown',
                outcome: 'ALLOWED',
                reason: 'Right to Erasure - DPDP Act 2023',
                timestamp: new Date()
            });

            return {
                leadId,
                success: true,
                purgedItems,
                timestamp: new Date()
            };
        } catch (error: any) {
            console.error(`[VerificationAgent] Purge failed for ${leadId}:`, error);
            return {
                leadId,
                success: false,
                purgedItems,
                timestamp: new Date()
            };
        }
    }

    /**
     * Log verification result for audit trail.
     */
    private async logVerification(result: VerificationResult, teamId: string): Promise<void> {
        try {
            await prisma.verificationLog.create({
                data: {
                    leadId: result.leadId,
                    teamId,
                    passed: result.passed,
                    score: result.score,
                    threshold: result.threshold,
                    recommendation: result.recommendation,
                    violations: result.violations as unknown as any,
                    explanation: result.explanation ? (result.explanation as unknown as any) : undefined
                }
            });
        } catch (error) {
            console.error('[VerificationAgent] Failed to log verification:', error);
        }
    }

    /**
     * Log compliance event for DPDP audit.
     */
    private async logComplianceEvent(event: ComplianceEvent): Promise<void> {
        console.log(`[DPDP Compliance] ${event.type}: Lead ${event.leadId} - ${event.outcome} - ${event.reason}`);

        // In production, persist to AuditLog
        try {
            const lead = await prisma.lead.findUnique({
                where: { id: event.leadId },
                select: { team: { select: { members: { where: { role: 'OWNER' }, take: 1, select: { userId: true } } } } }
            });

            const actorId = lead?.team?.members[0]?.userId;
            if (actorId) {
                await prisma.auditLog.create({
                    data: {
                        actorId,
                        orgId: event.teamId,
                        action: event.type,
                        entity: 'Lead',
                        entityId: event.leadId,
                        metadata: {
                            outcome: event.outcome,
                            reason: event.reason,
                            compliance: 'DPDP_ACT_2023'
                        }
                    }
                });
            }
        } catch (error) {
            console.error('[VerificationAgent] Failed to log compliance event:', error);
        }
    }

    /**
     * Update verification configuration.
     */
    updateConfig(config: { scoreThreshold?: number; requiredFields?: string[] }): void {
        if (config.scoreThreshold !== undefined) {
            this.scoreThreshold = config.scoreThreshold;
        }
        if (config.requiredFields) {
            this.requiredFields = config.requiredFields;
        }
    }

    /**
     * Get current configuration.
     */
    getConfig(): { scoreThreshold: number; requiredFields: string[] } {
        return {
            scoreThreshold: this.scoreThreshold,
            requiredFields: [...this.requiredFields]
        };
    }
}

// Singleton instance
export const verificationAgent = new VerificationAgent();
