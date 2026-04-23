export interface BuyerIntelInput {
    landingCampaignId: string;
    teamId: string;
}

export interface BuyerIntelResult {
    status: "stub" | "ok" | "error";
    signals?: Array<{ type: string; value: string }>;
    details?: string;
}

export class BuyerIntelAdapter {
    async fetchSignals(_input: BuyerIntelInput): Promise<BuyerIntelResult> {
        return {
            status: "stub",
            details: "Buyer intel adapter is not configured for this environment.",
            signals: [],
        };
    }
}
