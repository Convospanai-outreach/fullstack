export interface ROIFunnel {
    totalLeads: number;
    totalSent: number;
    opportunities: number;
    wins: number;
    conversionRate: number;
}

export interface ROIFinancials {
    spend: number;
    revenue: number;
    roi: number;
    profit: number;
}

export interface ROIResponse {
    funnel: ROIFunnel;
    financials: ROIFinancials;
    campaigns: Array<{ id: string; name: string; sent: number; openRate: number; replyRate: number; status: string }>;
    history: Array<{ date: string; revenue: number; spend: number }>;
}

export const ROIService = {
    getSummary: async (): Promise<ROIResponse> => {
        const res = await fetch(process.env["NEXT_PUBLIC_API_URL"] + "/analytics/roi");
        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Failed to load ROI metrics");
        }
        return res.json();
    }
};
