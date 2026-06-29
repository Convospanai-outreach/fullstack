
import type { VerificationResult, VerificationViolation, VerificationRecommendation, BatchVerificationResult } from "../types";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';
const isServer = typeof window === "undefined";

type VerificationConfig = {
    threshold: number;
};

const defaultConfig: VerificationConfig = {
    threshold: 0.4
};

let currentConfig: VerificationConfig = { ...defaultConfig };

export class VerificationAgent {
    updateConfig(config: Partial<VerificationConfig>) {
        currentConfig = { ...currentConfig, ...config };
    }

    async verify(leadId: string): Promise<VerificationResult> {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const { leadScoringService } = await import("./LeadScoringService");
            const lead = await prisma.lead.findUnique({
                where: { id: leadId },
                select: {
                    id: true,
                    teamId: true,
                    consentObtained: true,
                    dwellTimeMinutes: true,
                    emailClicks: true,
                    socialMentions: true
                }
            });
            if (!lead || !lead.teamId) {
                throw new Error("Lead not found");
            }

            const violations: VerificationViolation[] = [];
            if (!lead.consentObtained) {
                violations.push({
                    type: "NO_CONSENT",
                    severity: "ERROR",
                    message: "Consent not obtained for lead scoring"
                });
            }

            const input = {
                dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
                emailClicks: lead.emailClicks ?? 0,
                socialMentions: lead.socialMentions ?? 0
            };

            const score = await leadScoringService.calculateIntentScore(input);
            if (score.score < currentConfig.threshold) {
                violations.push({
                    type: "LOW_SCORE",
                    severity: "WARNING",
                    message: "Intent score below threshold"
                });
            }

            const passed = violations.every(v => v.severity !== "ERROR") && score.score >= currentConfig.threshold;
            const recommendation: VerificationRecommendation = passed ? "PROCESS" : violations.some(v => v.severity === "ERROR") ? "REJECT" : "REVIEW";

            const result: VerificationResult = {
                leadId,
                passed,
                score: score.score,
                threshold: currentConfig.threshold,
                violations,
                recommendation,
                verifiedAt: new Date()
            };

            await prisma.verificationLog.create({
                data: {
                    leadId,
                    teamId: lead.teamId,
                    passed,
                    score: score.score,
                    threshold: currentConfig.threshold,
                    recommendation,
                    violations: violations as any
                }
            });

            return result;
        }
        const res = await fetch(`${API_URL}/scoring/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId })
        });
        return await res.json();
    }

    async verifyBatch(leadIds: string[]): Promise<BatchVerificationResult> {
        if (isServer) {
            const results: VerificationResult[] = [];
            const failed: VerificationResult[] = [];

            for (const leadId of leadIds) {
                const result = await this.verify(leadId);
                if (result.passed) results.push(result);
                else failed.push(result);
            }

            const stats = {
                total: leadIds.length,
                passed: results.length,
                failed: failed.length,
                reviewRequired: failed.filter(r => r.recommendation === "REVIEW").length,
                passRate: leadIds.length ? results.length / leadIds.length : 0,
                averageScore: [...results, ...failed].reduce((sum, r) => sum + r.score, 0) / (leadIds.length || 1),
                commonViolations: []
            };

            return { passed: results, failed, stats };
        }
        const res = await fetch(`${API_URL}/scoring/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadIds })
        });
        return await res.json();
    }

    async purgeLeadData(leadId: string): Promise<{
        success: boolean;
        purgedItems?: {
            scoringData: boolean;
            verificationLogs: boolean;
            caseStudyMatches: boolean;
        }
    }> {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    intentScore: 0,
                    churnRisk: null,
                    clusterLabel: null,
                    optimalSendHour: null,
                    lastScoredAt: null
                }
            });
            await prisma.verificationLog.deleteMany({ where: { leadId } });
            return {
                success: true,
                purgedItems: {
                    scoringData: true,
                    verificationLogs: true,
                    caseStudyMatches: false
                }
            };
        }
        const res = await fetch(`${API_URL}/scoring/verify?leadId=${encodeURIComponent(leadId)}`, {
            method: "DELETE"
        });
        return await res.json();
    }
}

export const verificationAgent = new VerificationAgent();
