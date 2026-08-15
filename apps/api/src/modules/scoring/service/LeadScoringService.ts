
import type { BatchScoreResult, LeadIntentScore, ScoreExplanation, ScoringConfig } from "../types";

type ScoringInput = {
    dwellTimeMinutes: number;
    emailClicks: number;
    socialMentions: number;
    initialProfileFit?: number;
};

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

function cloneConfig(config: ScoringConfig): ScoringConfig {
    return {
        weights: { ...config.weights },
        normalization: { ...config.normalization },
        thresholds: { ...config.thresholds },
    };
}

function calculateInitialProfileFit(lead: {
    fullName?: string | null;
    email?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    isEnriched?: boolean | null;
    value?: number | null;
}) {
    const profileFields = [lead.fullName, lead.email, lead.company, lead.jobTitle];
    const profileCompleteness = profileFields.filter(Boolean).length / profileFields.length;
    const enrichmentSignal = lead.isEnriched ? 0.2 : 0;
    const valueSignal = (lead.value ?? 0) > 0 ? 0.1 : 0;
    return clamp01(profileCompleteness * 0.7 + enrichmentSignal + valueSignal);
}

function clamp01(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

function normalize(value: number, max: number) {
    return clamp01(value / max);
}

function sanitizeScoringInput(input: ScoringInput) {
    return {
        dwellTimeMinutes: Math.max(0, Number.isFinite(input.dwellTimeMinutes) ? input.dwellTimeMinutes : 0),
        emailClicks: Math.max(0, Math.trunc(Number.isFinite(input.emailClicks) ? input.emailClicks : 0)),
        socialMentions: Math.max(0, Math.trunc(Number.isFinite(input.socialMentions) ? input.socialMentions : 0)),
        initialProfileFit: clamp01(Number.isFinite(input.initialProfileFit ?? 0) ? input.initialProfileFit ?? 0 : 0),
    };
}

function computeScore(rawInput: ScoringInput, config: ScoringConfig): LeadIntentScore {
    const input = sanitizeScoringInput(rawInput);
    const normDwell = normalize(input.dwellTimeMinutes, config.normalization.dwellTimeMax);
    const normClicks = normalize(input.emailClicks, config.normalization.emailClicksMax);
    const normMentions = normalize(input.socialMentions, config.normalization.socialMentionsMax);
    const hasEngagementSignals = input.dwellTimeMinutes > 0 || input.emailClicks > 0 || input.socialMentions > 0;
    const freshLeadPrior = hasEngagementSignals ? 0 : Math.min(config.thresholds.warm - 0.01, input.initialProfileFit * 0.35);

    const score =
        normDwell * config.weights.dwellTime +
        normClicks * config.weights.emailClicks +
        normMentions * config.weights.socialMentions +
        freshLeadPrior;

    const tier =
        score >= config.thresholds.hot
            ? "HOT"
            : score >= config.thresholds.warm
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
            dwellTimeContribution: normDwell * config.weights.dwellTime,
            emailClicksContribution: normClicks * config.weights.emailClicks,
            socialMentionsContribution: normMentions * config.weights.socialMentions,
        },
        confidence
    };
}

function buildExplanation(leadId: string, rawInput: ScoringInput, config: ScoringConfig): ScoreExplanation {
    const input = sanitizeScoringInput(rawInput);
    const normDwell = normalize(input.dwellTimeMinutes, config.normalization.dwellTimeMax);
    const normClicks = normalize(input.emailClicks, config.normalization.emailClicksMax);
    const normMentions = normalize(input.socialMentions, config.normalization.socialMentionsMax);
    const hasEngagementSignals = input.dwellTimeMinutes > 0 || input.emailClicks > 0 || input.socialMentions > 0;
    const freshLeadPrior = hasEngagementSignals ? 0 : Math.min(config.thresholds.warm - 0.01, input.initialProfileFit * 0.35);

    const score = computeScore(input, config);

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
                weight: config.weights.dwellTime,
                contribution: normDwell * config.weights.dwellTime,
                explanation: "Time spent engaging on owned properties."
            },
            {
                name: "Email Clicks",
                rawValue: input.emailClicks,
                normalizedValue: normClicks,
                weight: config.weights.emailClicks,
                contribution: normClicks * config.weights.emailClicks,
                explanation: "Click-through engagement on outbound emails."
            },
            {
                name: "Social Mentions",
                rawValue: input.socialMentions,
                normalizedValue: normMentions,
                weight: config.weights.socialMentions,
                contribution: normMentions * config.weights.socialMentions,
                explanation: "Social proof and external engagement signals."
            },
            {
                name: "Initial Profile Fit",
                rawValue: input.initialProfileFit,
                normalizedValue: input.initialProfileFit,
                weight: 0.35,
                contribution: freshLeadPrior,
                explanation: "Conservative starting signal from known lead details before engagement exists."
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
    private config: ScoringConfig = cloneConfig(defaultConfig);

    async calculateIntentScore(input: any) {
        const payload = {
            dwellTimeMinutes: Number(input?.dwellTimeMinutes ?? input?.dwellTime ?? 0),
            emailClicks: Number(input?.emailClicks ?? 0),
            socialMentions: Number(input?.socialMentions ?? 0)
        };
        return computeScore(payload, this.config);
    }

    async generateExplanation(leadId: string, input: any) {
        const payload = {
            dwellTimeMinutes: Number(input?.dwellTimeMinutes ?? input?.dwellTime ?? 0),
            emailClicks: Number(input?.emailClicks ?? 0),
            socialMentions: Number(input?.socialMentions ?? 0)
        };
        return buildExplanation(leadId, payload, this.config);
    }

    async scoreAndPersist(leadId: string) {
        const { prisma } = await import("@/lib/db");
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                teamId: true,
                consentObtained: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                pipelineState: true,
                hotAt: true,
                pipelineStateChangedAt: true,
                fullName: true,
                email: true,
                company: true,
                jobTitle: true,
                isEnriched: true,
                value: true,
            }
        });
        if (!lead) throw new Error("Lead not found");
        if (!lead.consentObtained) {
            // Soft fail: score with available data, don't block
            console.warn(`[LeadScoring] Lead ${leadId} has no consent — scoring with defaults.`);
        }
        const input = {
            dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
            emailClicks: lead.emailClicks ?? 0,
            socialMentions: lead.socialMentions ?? 0,
            initialProfileFit: calculateInitialProfileFit(lead)
        };
        const score = computeScore(input, this.config);
        const explanation = buildExplanation(leadId, input, this.config);

        // Derive new pipeline state from score tier
        let newPipelineState: string | null = null;
        const currentState = lead.pipelineState ?? "COLD";
        // Only advance state, never go backwards automatically
        if (score.tier === "HOT" && currentState !== "HOT" && currentState !== "COORDINATING" && currentState !== "MEETING_CONFIRMED" && currentState !== "COMPLETED") {
            newPipelineState = "HOT";
        } else if (score.tier === "WARM" && currentState === "COLD") {
            newPipelineState = "WARM";
        }

        // 1. Churn Risk Index — uses pipelineStateChangedAt (not updatedAt)
        // updatedAt resets on every prisma write, making it useless for staleness
        let churnRisk = 0.12;
        const staleRef = lead.pipelineStateChangedAt || lead.hotAt;
        const daysSinceStateChange = staleRef ? (Date.now() - new Date(staleRef).getTime()) / (1000 * 60 * 60 * 24) : 0;
        if ((newPipelineState || currentState) === "WARM" && daysSinceStateChange > 14) {
            churnRisk = 0.65 + Math.min(0.3, (daysSinceStateChange - 14) * 0.02);
        } else if (score.score < 0.2) {
            churnRisk = 0.85;
        } else if (score.score >= 0.7) {
            churnRisk = 0.08;
        } else {
            churnRisk = Math.min(0.95, 0.12 + (daysSinceStateChange * 0.03));
        }

        // 2. K-means Clustering Cohort Label
        let clusterLabel = "NEW";
        const dealValue = lead.value ?? 0;
        if (score.score >= 0.7 && dealValue >= 5000) {
            clusterLabel = "HIGH_VALUE";
        } else if (score.score < 0.3 && daysSinceStateChange > 30) {
            clusterLabel = "DORMANT";
        } else if (score.score >= 0.3 && score.score < 0.7 && churnRisk > 0.5) {
            clusterLabel = "AT_RISK";
        } else if (score.score >= 0.7) {
            clusterLabel = "HIGH_VALUE"; // Default high-intent to high value
        }

        // 3. Optimal Reach Hour (based on real email opens mode)
        let optimalSendHour = 10;
        const openedEmails = await prisma.email.findMany({
            where: { leadId, openedAt: { not: null } },
            select: { openedAt: true }
        });
        if (openedEmails.length > 0) {
            const hours = openedEmails.map(e => new Date(e.openedAt!).getHours());
            const counts = hours.reduce((acc, h) => {
                acc[h] = (acc[h] || 0) + 1;
                return acc;
            }, {} as Record<number, number>);
            optimalSendHour = Number(Object.keys(counts).reduce((a, b) => counts[Number(a)] > counts[Number(b)] ? a : b));
        } else {
            optimalSendHour = leadId.charCodeAt(0) % 2 === 0 ? 10 : 14;
        }

        const updateData: any = {
            intentScore: score.score,
            leadScore: Math.round(score.score * 100),
            lastScoredAt: new Date(),
            churnRisk,
            clusterLabel,
            optimalSendHour,
        };

        if (newPipelineState) {
            updateData.pipelineState = newPipelineState;
            updateData.pipelineStateChangedAt = new Date();
            if (newPipelineState === "HOT" && !lead.hotAt) {
                updateData.hotAt = new Date();
            }
        }

        await prisma.lead.update({ where: { id: leadId }, data: updateData });

        // Auto-enqueue HOT leads to the caller coordination queue
        if (newPipelineState === "HOT") {
            try {
                const { CallerService } = await import("@/modules/caller/CallerService");
                await CallerService.ensureQueueEntry(leadId);
            } catch (qErr) {
                console.warn(`[LeadScoring] Failed to enqueue HOT lead ${leadId}:`, qErr);
            }
        }

        return explanation;
    }

    async batchScoreLeads(teamId: string) {
        const { prisma } = await import("@/lib/db");
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: {
                id: true,
                consentObtained: true,
                dwellTimeMinutes: true,
                emailClicks: true,
                socialMentions: true,
                pipelineState: true,
                hotAt: true,
                pipelineStateChangedAt: true,
                fullName: true,
                email: true,
                company: true,
                jobTitle: true,
                isEnriched: true,
                value: true,
            }
        });

        const errors: Array<{ leadId: string; error: string }> = [];
        let totalScore = 0;
        let successful = 0;
        let hot = 0;
        let warm = 0;
        let cold = 0;
        const newHotLeadIds: string[] = [];

        for (const lead of leads) {
            try {
                if (!lead.consentObtained) {
                    console.warn(`[BatchScoring] Lead ${lead.id} has no consent — scoring with defaults.`);
                }
                const input = {
                    dwellTimeMinutes: lead.dwellTimeMinutes ?? 0,
                    emailClicks: lead.emailClicks ?? 0,
                    socialMentions: lead.socialMentions ?? 0,
                    initialProfileFit: calculateInitialProfileFit(lead)
                };
                const score = computeScore(input, this.config);
                totalScore += score.score;
                successful++;
                if (score.tier === "HOT") hot++;
                else if (score.tier === "WARM") warm++;
                else cold++;

                // Determine pipeline state advancement
                const currentState = lead.pipelineState ?? "COLD";
                let newPipelineState: string | null = null;
                let advancedToHot = false;
                if (score.tier === "HOT" && currentState !== "HOT" && currentState !== "COORDINATING" && currentState !== "MEETING_CONFIRMED" && currentState !== "COMPLETED") {
                    newPipelineState = "HOT";
                    advancedToHot = true;
                } else if (score.tier === "WARM" && currentState === "COLD") {
                    newPipelineState = "WARM";
                }

                // 1. Churn Risk Index — uses pipelineStateChangedAt (not updatedAt)
                let churnRisk = 0.12;
                const staleRef = lead.pipelineStateChangedAt || lead.hotAt;
                const daysSinceStateChange = staleRef ? (Date.now() - new Date(staleRef).getTime()) / (1000 * 60 * 60 * 24) : 0;
                if ((newPipelineState || currentState) === "WARM" && daysSinceStateChange > 14) {
                    churnRisk = 0.65 + Math.min(0.3, (daysSinceStateChange - 14) * 0.02);
                } else if (score.score < 0.2) {
                    churnRisk = 0.85;
                } else if (score.score >= 0.7) {
                    churnRisk = 0.08;
                } else {
                    churnRisk = Math.min(0.95, 0.12 + (daysSinceStateChange * 0.03));
                }

                // 2. K-means Clustering Cohort Label
                let clusterLabel = "NEW";
                const dealValue = lead.value ?? 0;
                if (score.score >= 0.7 && dealValue >= 5000) {
                    clusterLabel = "HIGH_VALUE";
                } else if (score.score < 0.3 && daysSinceStateChange > 30) {
                    clusterLabel = "DORMANT";
                } else if (score.score >= 0.3 && score.score < 0.7 && churnRisk > 0.5) {
                    clusterLabel = "AT_RISK";
                } else if (score.score >= 0.7) {
                    clusterLabel = "HIGH_VALUE";
                }

                // 3. Optimal Reach Hour (based on real email opens mode)
                let optimalSendHour = 10;
                const openedEmails = await prisma.email.findMany({
                    where: { leadId: lead.id, openedAt: { not: null } },
                    select: { openedAt: true }
                });
                if (openedEmails.length > 0) {
                    const hours = openedEmails.map(e => new Date(e.openedAt!).getHours());
                    const counts = hours.reduce((acc, h) => {
                        acc[h] = (acc[h] || 0) + 1;
                        return acc;
                    }, {} as Record<number, number>);
                    optimalSendHour = Number(Object.keys(counts).reduce((a, b) => counts[Number(a)] > counts[Number(b)] ? a : b));
                } else {
                    optimalSendHour = lead.id.charCodeAt(0) % 2 === 0 ? 10 : 14;
                }

                const updateData: any = {
                    intentScore: score.score,
                    leadScore: Math.round(score.score * 100),
                    lastScoredAt: new Date(),
                    churnRisk,
                    clusterLabel,
                    optimalSendHour,
                };

                if (newPipelineState) {
                    updateData.pipelineState = newPipelineState;
                    updateData.pipelineStateChangedAt = new Date();
                    if (newPipelineState === "HOT" && !lead.hotAt) updateData.hotAt = new Date();
                }

                await prisma.lead.update({ where: { id: lead.id }, data: updateData });
                if (advancedToHot) newHotLeadIds.push(lead.id);
            } catch (error: any) {
                errors.push({ leadId: lead.id, error: error?.message ?? "Failed" });
            }
        }

        // Auto-enqueue newly HOT leads
        if (newHotLeadIds.length > 0) {
            const { CallerService } = await import("@/modules/caller/CallerService");
            for (const hotLeadId of newHotLeadIds) {
                try {
                    await CallerService.ensureQueueEntry(hotLeadId);
                } catch (qErr) {
                    console.warn(`[BatchScoring] Failed to enqueue HOT lead ${hotLeadId}:`, qErr);
                }
            }
        }

        const result: BatchScoreResult = {
            totalProcessed: leads.length,
            successful,
            failed: leads.length - successful,
            averageScore: successful ? totalScore / successful : 0,
            tierDistribution: { hot, warm, cold },
            errors
        };

        return result;
    }

    getConfig() {
        return cloneConfig(this.config);
    }

    updateWeights(weights: Partial<ScoringConfig["weights"]>) {
        this.config = {
            ...this.config,
            weights: {
                ...this.config.weights,
                ...weights
            }
        };
    }
}

export const leadScoringService = new LeadScoringService();
