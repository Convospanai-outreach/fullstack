import type { ChurnPrediction, ClusterAssignment, CustomerCluster, OptimalSendTime } from "../types";

function clamp01(value: number) {
    if (Number.isNaN(value)) return 0;
    return Math.max(0, Math.min(1, value));
}

export class PredictiveService {
    async predictChurn(leadId: string) {
        const { prisma } = await import("@/lib/db");
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                intentScore: true,
                churnRisk: true,
                pipelineStateChangedAt: true,
                hotAt: true,
                createdAt: true,
            }
        });
        if (!lead) throw new Error("Lead not found");

        const stalenessRef = lead.pipelineStateChangedAt || lead.hotAt || lead.createdAt;
        const daysSince = (Date.now() - stalenessRef.getTime()) / (1000 * 60 * 60 * 24);
        const baseRisk = clamp01(daysSince / 90);
        const engagementFactor = 1 - clamp01(lead.intentScore ?? 0);
        const churnProbability = clamp01((baseRisk * 0.7) + (engagementFactor * 0.3));

        const riskLevel = churnProbability > 0.7 ? "HIGH" : churnProbability > 0.4 ? "MEDIUM" : "LOW";
        const prediction: ChurnPrediction = {
            leadId,
            churnProbability,
            riskLevel,
            riskFactors: [
                daysSince > 60 ? "No recent activity" : "Recent engagement detected",
                (lead.intentScore ?? 0) < 0.3 ? "Low intent signals" : "Healthy intent signals"
            ],
            recommendedActions: [
                "Send targeted follow-up",
                "Offer a high-value asset",
                "Schedule a check-in call"
            ],
            predictedAt: new Date()
        };

        await prisma.lead.update({
            where: { id: leadId },
            data: { churnRisk: churnProbability }
        });

        return prediction;
    }

    async calculateOptimalSendTime(leadId: string) {
        const { prisma } = await import("@/lib/db");
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: { id: true, emails: { select: { openedAt: true } }, optimalSendHour: true }
        });
        if (!lead) throw new Error("Lead not found");

        const openHours = lead.emails
            .map(e => e.openedAt?.getHours())
            .filter((h): h is number => typeof h === "number");

        const optimalHour = openHours.length
            ? Math.round(openHours.reduce((a, b) => a + b, 0) / openHours.length)
            : (lead.optimalSendHour ?? 9);

        const result: OptimalSendTime = {
            leadId,
            optimalHour,
            optimalDay: "TUESDAY",
            confidence: openHours.length ? clamp01(openHours.length / 10) : 0.4,
            historicalOpenPattern: Array.from({ length: 24 }, (_, i) => openHours.filter(h => h === i).length),
            predictedAt: new Date()
        };

        await prisma.lead.update({
            where: { id: leadId },
            data: { optimalSendHour: optimalHour }
        });

        return result;
    }

    async clusterCustomers(teamId: string) {
        const { prisma } = await import("@/lib/db");
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: {
                id: true,
                value: true,
                intentScore: true,
                churnRisk: true,
                createdAt: true,
                pipelineStateChangedAt: true,
                hotAt: true,
            }
        });

        const clusters: Record<string, CustomerCluster> = {};

        for (const lead of leads) {
            const stalenessRef = lead.pipelineStateChangedAt || lead.hotAt || lead.createdAt;
            const daysSince = (Date.now() - stalenessRef.getTime()) / (1000 * 60 * 60 * 24);
            let label: CustomerCluster["label"] = "DORMANT";
            if ((lead.value ?? 0) > 5000 || (lead.intentScore ?? 0) > 0.7) {
                label = "HIGH_VALUE";
            } else if ((lead.churnRisk ?? 0) > 0.7 || daysSince > 90) {
                label = "AT_RISK";
            } else if ((Date.now() - lead.createdAt.getTime()) < 30 * 24 * 60 * 60 * 1000) {
                label = "NEW";
            }

            const cluster = clusters[label] ?? (clusters[label] = {
                label,
                centroid: [],
                memberCount: 0,
                characteristics: [],
                averageValue: 0
            });
            cluster.memberCount += 1;
            cluster.averageValue += lead.value ?? 0;
        }

        return Object.values(clusters).map(c => ({
            ...c,
            averageValue: c.memberCount ? c.averageValue / c.memberCount : 0,
            characteristics: c.characteristics.length
                ? c.characteristics
                : [
                    c.label === "HIGH_VALUE" ? "High intent or deal size" : "",
                    c.label === "AT_RISK" ? "Low engagement or long inactivity" : "",
                    c.label === "NEW" ? "Recently created leads" : "Dormant leads"
                ].filter(Boolean)
        }));
    }

    assignToCluster(leadId: string, features: { value: number; engagement: number; recency: number; frequency: number }): ClusterAssignment {
        const score = features.value * 0.4 + features.engagement * 0.3 + features.recency * 0.2 + features.frequency * 0.1;
        let clusterLabel: ClusterAssignment["clusterLabel"] = "DORMANT";
        if (score > 0.75) clusterLabel = "HIGH_VALUE";
        else if (score > 0.5) clusterLabel = "AT_RISK";
        else if (features.recency > 0.7) clusterLabel = "NEW";
        return {
            leadId,
            clusterLabel,
            distance: clamp01(1 - score),
            confidence: clamp01(score)
        };
    }
}

export const predictiveService = new PredictiveService();
