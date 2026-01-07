/**
 * Predictive Analytics Service
 * 
 * Implements grant-ready predictive algorithms:
 * - Churn Prediction (Random Forest/XGBoost style weighted features)
 * - Optimal Send Time (Time Series analysis)
 * - Customer Clustering (K-Means style segmentation)
 */

import { prisma } from "@/lib/db";
import type {
    ChurnPrediction,
    OptimalSendTime,
    CustomerCluster,
    ClusterLabel,
    ClusterAssignment
} from "../types";

// Feature weights for churn prediction (simulates Random Forest importance)
const CHURN_FEATURE_WEIGHTS = {
    daysSinceLogin: 0.25,
    emailOpenRate: 0.20,
    dealProgress: 0.20,
    responseTime: 0.15,
    meetingFrequency: 0.10,
    sentimentTrend: 0.10
};

// Cluster centroids for K-Means style classification
const CLUSTER_CENTROIDS: Record<ClusterLabel, { value: number; engagement: number; recency: number; frequency: number }> = {
    'HIGH_VALUE': { value: 0.9, engagement: 0.85, recency: 0.9, frequency: 0.8 },
    'AT_RISK': { value: 0.6, engagement: 0.2, recency: 0.3, frequency: 0.25 },
    'NEW': { value: 0.3, engagement: 0.5, recency: 0.95, frequency: 0.3 },
    'DORMANT': { value: 0.4, engagement: 0.1, recency: 0.1, frequency: 0.1 }
};

export class PredictiveService {

    /**
     * Predict churn probability using weighted feature analysis.
     * Simulates Random Forest/XGBoost approach.
     */
    async predictChurn(leadId: string): Promise<ChurnPrediction> {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: {
                emails: {
                    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
                    select: { openedAt: true, createdAt: true }
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: { direction: true, createdAt: true }
                },
                meetings: {
                    where: { startTime: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) } },
                    select: { id: true }
                }
            }
        });

        if (!lead) {
            throw new Error(`Lead not found: ${leadId}`);
        }

        // Feature extraction
        const daysSinceLastActivity = this.getDaysSinceLastActivity(lead.updatedAt);
        const emailOpenRate = this.calculateEmailOpenRate(lead.emails);
        const dealProgress = this.normalizeDealProgress(lead.status);
        const responseTime = this.calculateAverageResponseTime(lead.messages);
        const meetingFrequency = this.normalizeMeetingFrequency(lead.meetings.length);
        const sentimentTrend = 0.5; // Placeholder - would need NLP analysis

        // Calculate churn score (0 = low churn risk, 1 = high churn risk)
        const churnScore =
            (daysSinceLastActivity * CHURN_FEATURE_WEIGHTS.daysSinceLogin) +
            ((1 - emailOpenRate) * CHURN_FEATURE_WEIGHTS.emailOpenRate) +
            ((1 - dealProgress) * CHURN_FEATURE_WEIGHTS.dealProgress) +
            (responseTime * CHURN_FEATURE_WEIGHTS.responseTime) +
            ((1 - meetingFrequency) * CHURN_FEATURE_WEIGHTS.meetingFrequency) +
            ((1 - sentimentTrend) * CHURN_FEATURE_WEIGHTS.sentimentTrend);

        const riskFactors: string[] = [];
        const recommendedActions: string[] = [];

        // Identify risk factors
        if (daysSinceLastActivity > 0.7) {
            riskFactors.push('no_activity_30d');
            recommendedActions.push('Send re-engagement email');
        }
        if (emailOpenRate < 0.3) {
            riskFactors.push('low_email_engagement');
            recommendedActions.push('Try different subject lines or send times');
        }
        if (dealProgress < 0.3) {
            riskFactors.push('stalled_deal');
            recommendedActions.push('Schedule a discovery call');
        }
        if (meetingFrequency < 0.2) {
            riskFactors.push('no_meetings');
            recommendedActions.push('Propose a demo or consultation');
        }

        // Update lead with churn risk
        await prisma.lead.update({
            where: { id: leadId },
            data: { churnRisk: churnScore }
        });

        return {
            leadId,
            churnProbability: Math.round(churnScore * 100) / 100,
            riskLevel: churnScore >= 0.7 ? 'HIGH' : churnScore >= 0.4 ? 'MEDIUM' : 'LOW',
            riskFactors,
            recommendedActions,
            predictedAt: new Date()
        };
    }

    private getDaysSinceLastActivity(lastUpdate: Date): number {
        const days = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
        return Math.min(days / 60, 1); // Normalize: 60 days = max risk
    }

    private calculateEmailOpenRate(emails: Array<{ openedAt: Date | null }>): number {
        if (emails.length === 0) return 0;
        const opened = emails.filter(e => e.openedAt !== null).length;
        return opened / emails.length;
    }

    private normalizeDealProgress(status: string): number {
        const stages: Record<string, number> = {
            'NEW': 0.1,
            'CONTACTED': 0.25,
            'QUALIFIED': 0.4,
            'PROPOSAL': 0.6,
            'NEGOTIATION': 0.8,
            'CLOSED_WON': 1.0,
            'CLOSED_LOST': 0.0
        };
        return stages[status] ?? 0.2;
    }

    private calculateAverageResponseTime(messages: Array<{ direction: string; createdAt: Date }>): number {
        // Simplified: just check if there are recent inbound messages
        const inbound = messages.filter(m => m.direction === 'INBOUND');
        if (inbound.length === 0) return 0.8; // High risk if no responses
        return 0.3; // Low risk if responding
    }

    private normalizeMeetingFrequency(count: number): number {
        return Math.min(count / 3, 1); // 3+ meetings in 90 days = max engagement
    }

    /**
     * Calculate optimal send time using historical email open patterns.
     * Uses time series analysis approach.
     */
    async calculateOptimalSendTime(leadId: string): Promise<OptimalSendTime> {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            select: {
                id: true,
                emails: {
                    where: { openedAt: { not: null } },
                    select: { openedAt: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!lead) {
            throw new Error(`Lead not found: ${leadId}`);
        }

        // Build hourly histogram (24 buckets)
        const hourlyPattern = new Array(24).fill(0);
        const dayPattern: Record<string, number> = {
            MONDAY: 0, TUESDAY: 0, WEDNESDAY: 0, THURSDAY: 0,
            FRIDAY: 0, SATURDAY: 0, SUNDAY: 0
        };

        for (const email of lead.emails) {
            if (email.openedAt) {
                const hour = email.openedAt.getHours();
                const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
                const dayIndex = email.openedAt.getDay();
                const day = dayNames[dayIndex] ?? 'MONDAY';
                const patternValue = hourlyPattern[hour];
                if (patternValue !== undefined && day !== undefined) {
                    hourlyPattern[hour] = patternValue + 1;
                    dayPattern[day] = (dayPattern[day] ?? 0) + 1;
                }
            }
        }

        // Find optimal hour and day
        let optimalHour = 9; // Default: 9 AM
        let maxHourCount = 0;
        let optimalDay: OptimalSendTime['optimalDay'] = 'TUESDAY';
        let maxDayCount = 0;

        for (let h = 0; h < 24; h++) {
            if (hourlyPattern[h] > maxHourCount) {
                maxHourCount = hourlyPattern[h];
                optimalHour = h;
            }
        }

        for (const [day, count] of Object.entries(dayPattern)) {
            if (count > maxDayCount) {
                maxDayCount = count;
                optimalDay = day as OptimalSendTime['optimalDay'];
            }
        }

        // Calculate confidence based on data volume
        const totalOpens = lead.emails.length;
        const confidence = Math.min(totalOpens / 20, 1); // 20+ opens = high confidence

        // Update lead with optimal send hour
        await prisma.lead.update({
            where: { id: leadId },
            data: { optimalSendHour: optimalHour }
        });

        return {
            leadId,
            optimalHour,
            optimalDay,
            confidence: Math.round(confidence * 100) / 100,
            historicalOpenPattern: hourlyPattern,
            predictedAt: new Date()
        };
    }

    /**
     * Cluster all customers in a team using K-Means style segmentation.
     */
    async clusterCustomers(teamId: string): Promise<CustomerCluster[]> {
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: {
                id: true,
                value: true,
                intentScore: true,
                updatedAt: true,
                emails: { select: { id: true } },
                messages: { select: { id: true } }
            }
        });

        const clusters: Record<ClusterLabel, { leads: string[]; totalValue: number }> = {
            'HIGH_VALUE': { leads: [], totalValue: 0 },
            'AT_RISK': { leads: [], totalValue: 0 },
            'NEW': { leads: [], totalValue: 0 },
            'DORMANT': { leads: [], totalValue: 0 }
        };

        for (const lead of leads) {
            // Calculate feature vector
            const features = {
                value: Math.min((lead.value || 0) / 10000, 1), // Normalize to 10k max
                engagement: lead.intentScore || 0,
                recency: this.calculateRecency(lead.updatedAt),
                frequency: Math.min((lead.emails.length + lead.messages.length) / 20, 1)
            };

            // Find nearest cluster centroid
            const assignment = this.assignToCluster(lead.id, features);
            clusters[assignment.clusterLabel].leads.push(lead.id);
            clusters[assignment.clusterLabel].totalValue += lead.value || 0;

            // Update lead with cluster label
            await prisma.lead.update({
                where: { id: lead.id },
                data: { clusterLabel: assignment.clusterLabel }
            });
        }

        // Build cluster summaries
        const result: CustomerCluster[] = [];
        for (const [label, data] of Object.entries(clusters)) {
            result.push({
                label: label as ClusterLabel,
                centroid: Object.values(CLUSTER_CENTROIDS[label as ClusterLabel]),
                memberCount: data.leads.length,
                averageValue: data.leads.length > 0 ? data.totalValue / data.leads.length : 0,
                characteristics: this.getClusterCharacteristics(label as ClusterLabel)
            });
        }

        return result;
    }

    private calculateRecency(updatedAt: Date): number {
        const days = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
        return Math.max(1 - (days / 90), 0); // 90 days = 0 recency
    }

    /**
     * Assign a lead to the nearest cluster using Euclidean distance.
     */
    assignToCluster(
        leadId: string,
        features: { value: number; engagement: number; recency: number; frequency: number }
    ): ClusterAssignment {
        let minDistance = Infinity;
        let nearestCluster: ClusterLabel = 'NEW';

        for (const [label, centroid] of Object.entries(CLUSTER_CENTROIDS)) {
            const distance = Math.sqrt(
                Math.pow(features.value - centroid.value, 2) +
                Math.pow(features.engagement - centroid.engagement, 2) +
                Math.pow(features.recency - centroid.recency, 2) +
                Math.pow(features.frequency - centroid.frequency, 2)
            );

            if (distance < minDistance) {
                minDistance = distance;
                nearestCluster = label as ClusterLabel;
            }
        }

        // Confidence: closer = higher confidence
        const maxPossibleDistance = 2; // sqrt(4) = 2 for normalized features
        const confidence = Math.max(1 - (minDistance / maxPossibleDistance), 0);

        return {
            leadId,
            clusterLabel: nearestCluster,
            distance: Math.round(minDistance * 1000) / 1000,
            confidence: Math.round(confidence * 100) / 100
        };
    }

    private getClusterCharacteristics(label: ClusterLabel): string[] {
        const chars: Record<ClusterLabel, string[]> = {
            'HIGH_VALUE': ['High deal value', 'Strong engagement', 'Recent activity', 'Frequent interactions'],
            'AT_RISK': ['Previously engaged', 'Declining activity', 'No recent meetings', 'Slow response time'],
            'NEW': ['Recently added', 'Low historical data', 'Initial engagement', 'Discovery phase'],
            'DORMANT': ['No recent activity', 'Low engagement', 'Stalled pipeline', 'Re-engagement needed']
        };
        return chars[label];
    }
}

// Singleton instance
export const predictiveService = new PredictiveService();
