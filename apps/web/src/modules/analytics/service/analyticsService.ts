
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

class AnalyticsService {
    async getStats(teamId?: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/stats?teamId=${teamId || ''}`);
            return await res.json();
        } catch {
            return { overview: {}, campaignPerformance: [] };
        }
    }

    async getFunnelStats(teamId?: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/funnel?teamId=${teamId || ''}`);
            return await res.json();
        } catch {
            return { outreach: 0, replied: 0, meetings: 0, deals: 0, revenue: 0 };
        }
    }

    async getCampaignStats(campaignId: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/campaign?campaignId=${campaignId}`);
            return await res.json();
        } catch {
            return { metrics: {}, usage: {}, timeline: [] };
        }
    }

    async getVariantComparison(campaignId: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/variants?campaignId=${campaignId}`);
            return await res.json();
        } catch {
            return [];
        }
    }

    async getCohortAnalysis(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/cohorts?teamId=${teamId}`);
            return await res.json();
        } catch {
            return [];
        }
    }

    async getForecastingStats(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/forecast?teamId=${teamId}`);
            return await res.json();
        } catch {
            return { currentRevenue: 0, weightedPipeline: 0 };
        }
    }

    async getGovernanceStats(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/analytics/governance?teamId=${teamId}`);
            return await res.json();
        } catch {
            return { totalLogs: 0, blockedActions: 0 };
        }
    }
}

export const analyticsService = new AnalyticsService();
