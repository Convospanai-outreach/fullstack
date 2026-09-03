
import type { BatchScoreResult, LeadIntentScore, ScoreExplanation, ScoringConfig } from "../types";
import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();
const isServer = typeof window === "undefined";

const defaultConfig: ScoringConfig = {
    weights: {
        dwellTime: 0.4,
        emailClicks: 0.35,
        socialMentions: 0.25,
    },
    normalization: {
        dwellTimeMax: 20,
        emailClicksMax: 20,
        socialMentionsMax: 10,
    },
    thresholds: {
        hot: 0.7,
        warm: 0.4,
    }
};

let currentConfig: ScoringConfig = { ...defaultConfig };

function clamp01(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function normalize(value: number, max: number) {
    return clamp01(value / max);
}

function computeScore(input: { dwellTimeMinutes: number; emailClicks: number; socialMentions: number }): LeadIntentScore {
    const normDwell = normalize(input.dwellTimeMinutes, currentConfig.normalization.dwellTimeMax);
    const normClicks = normalize(input.emailClicks, currentConfig.normalization.emailClicksMax);
    const normMentions = normalize(input.socialMentions, currentConfig.normalization.socialMentionsMax);

    const score =
        normDwell * currentConfig.weights.dwellTime +
        normClicks * currentConfig.weights.emailClicks +
        normMentions * currentConfig.weights.socialMentions;

    const tier =
        score >= currentConfig.thresholds.hot
            ? "HOT"
            : score >= currentConfig.thresholds.warm
                ? "WARM"
                : "COLD";

    const confidence = clamp01(
        (Number(Boolean(input.dwellTimeMinutes)) +
            Number(Boolean(input.emailClicks)) +
            Number(Boolean(input.socialMentions))) / 3
    );

    return {
        score,
        tier,
        breakdown: {
            dwellTimeContribution: normDwell * currentConfig.weights.dwellTime,
            emailClicksContribution: normClicks * currentConfig.weights.emailClicks,
            socialMentionsContribution: normMentions * currentConfig.weights.socialMentions,
        },
        confidence
    };
}

function buildExplanation(leadId: string, input: { dwellTimeMinutes: number; emailClicks: number; socialMentions: number }): ScoreExplanation {
    const normDwell = normalize(input.dwellTimeMinutes, currentConfig.normalization.dwellTimeMax);
    const normClicks = normalize(input.emailClicks, currentConfig.normalization.emailClicksMax);
    const normMentions = normalize(input.socialMentions, currentConfig.normalization.socialMentionsMax);

    const score = computeScore(input);

    return {
        leadId,
        finalScore: score.score,
        tier: score.tier,
        summary: `Lead scored ${score.tier} with ${(score.score * 100).toFixed(0)}% intent confidence.`,
        factors: [
            {
                name: "Dwell Time",
                rawValue: input.dwellTimeMinutes,
                normalizedValue: normDwell,
                weight: currentConfig.weights.dwellTime,
                contribution: normDwell * currentConfig.weights.dwellTime,
                explanation: "Time spent engaging on owned properties."
            },
            {
                name: "Email Clicks",
                rawValue: input.emailClicks,
                normalizedValue: normClicks,
                weight: currentConfig.weights.emailClicks,
                contribution: normClicks * currentConfig.weights.emailClicks,
                explanation: "Click-through engagement on outbound emails."
            },
            {
                name: "Social Mentions",
                rawValue: input.socialMentions,
                normalizedValue: normMentions,
                weight: currentConfig.weights.socialMentions,
                contribution: normMentions * currentConfig.weights.socialMentions,
                explanation: "Social proof and external engagement signals."
            }
        ],
        dataQuality: {
            completeness: score.confidence,
            recency: 1,
            confidenceLevel: score.confidence > 0.7 ? "HIGH" : score.confidence > 0.4 ? "MEDIUM" : "LOW"
        },
        scoredAt: new Date()
    };
}

export class LeadScoringService {
    async calculateIntentScore(input: any) {
        if (isServer) {
            const payload = {
                dwellTimeMinutes: Number(input?.dwellTimeMinutes ?? input?.dwellTime ?? 0),
                emailClicks: Number(input?.emailClicks ?? 0),
                socialMentions: Number(input?.socialMentions ?? 0)
            };
            return computeScore(payload);
        }
        try {
            const res = await fetch(`${API_URL}/scoring/calculate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input })
            });
            return await res.json();
        } catch {
            return { score: 0, tier: 'COLD' };
        }
    }

    async generateExplanation(leadId: string, input: any) {
        if (isServer) {
            const payload = {
                dwellTimeMinutes: Number(input?.dwellTimeMinutes ?? input?.dwellTime ?? 0),
                emailClicks: Number(input?.emailClicks ?? 0),
                socialMentions: Number(input?.socialMentions ?? 0)
            };
            return buildExplanation(leadId, payload);
        }
        try {
            const res = await fetch(`${API_URL}/scoring/explain`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, input })
            });
            return await res.json();
        } catch {
            return { summary: "Scoring explanation failed" };
        }
    }

    async scoreAndPersist(leadId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
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
            if (!lead) throw new Error("Lead not found");
            if (!lead.consentObtained) {
                throw new Error("DPDP_COMPLIANCE: Consent required");
            }
            const input = {
                dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
                emailClicks: lead.emailClicks ?? 0,
                socialMentions: lead.socialMentions ?? 0
            };
            const score = computeScore(input);
            const explanation = buildExplanation(leadId, input);
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    intentScore: score.score,
                    lastScoredAt: new Date()
                }
            });
            return explanation;
        }
        try {
            const res = await fetch(`${API_URL}/scoring/persist`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId })
            });
            return await res.json();
        } catch (error) {
            console.error("Scoring proxy failed:", error);
            throw error;
        }
    }

    async batchScoreLeads(teamId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const leads = await prisma.lead.findMany({
                where: { teamId },
                select: {
                    id: true,
                    consentObtained: true,
                    dwellTimeMinutes: true,
                    emailClicks: true,
                    socialMentions: true
                }
            });

            const errors: Array<{ leadId: string; error: string }> = [];
            let totalScore = 0;
            let successful = 0;
            let hot = 0;
            let warm = 0;
            let cold = 0;

            for (const lead of leads) {
                try {
                    if (!lead.consentObtained) {
                        throw new Error("CONSENT_REQUIRED");
                    }
                    const input = {
                        dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
                        emailClicks: lead.emailClicks ?? 0,
                        socialMentions: lead.socialMentions ?? 0
                    };
                    const score = computeScore(input);
                    totalScore += score.score;
                    successful++;
                    if (score.tier === "HOT") hot++;
                    else if (score.tier === "WARM") warm++;
                    else cold++;
                    await prisma.lead.update({
                        where: { id: lead.id },
                        data: { intentScore: score.score, lastScoredAt: new Date() }
                    });
                } catch (error: any) {
                    errors.push({ leadId: lead.id, error: error?.message ?? "Failed" });
                }
            }

            const result: BatchScoreResult = {
                totalProcessed: leads.length,
                successful,
                failed: leads.length - successful,
                averageScore: successful ? totalScore / successful : 0,
                tierDistribution: {
                    hot,
                    warm,
                    cold
                },
                errors
            };

            return result;
        }
        try {
            const res = await fetch(`${API_URL}/scoring/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId })
            });
            return await res.json();
        } catch {
            return { successful: 0, failed: 0 };
        }
    }

    getConfig() {
        return currentConfig;
    }

    updateWeights(weights: Partial<ScoringConfig["weights"]>) {
        currentConfig = {
            ...currentConfig,
            weights: {
                ...currentConfig.weights,
                ...weights
            }
        };
    }
}

export const leadScoringService = new LeadScoringService();
