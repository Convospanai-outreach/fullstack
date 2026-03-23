export interface ROIMetrics {
    mrr: number;
    arr: number;
    clv: number;
    cac: number;
    churnRate: number;
    netRevenueRetention: number;
    paybackPeriodDays: number;
    healthScore: number; // 0-100
}

export const MockROIService = {
    getMetrics: async (): Promise<ROIMetrics> => {
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 500));

        return {
            mrr: 12500,
            arr: 150000,
            clv: 4200,
            cac: 350,
            churnRate: 2.1,
            netRevenueRetention: 115,
            paybackPeriodDays: 45,
            healthScore: 88,
        };
    },

    getTrends: async (_metric: keyof ROIMetrics) => {
        // Mock trend data for charts
        await new Promise(resolve => setTimeout(resolve, 300));
        const points = 12; // Last 12 months/weeks
        return Array.from({ length: points }).map((_, i) => ({
            date: new Date(Date.now() - (points - 1 - i) * 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
            value: Math.floor(Math.random() * 1000) + 1000 + (i * 100) // Upward trend
        }));
    }
};
