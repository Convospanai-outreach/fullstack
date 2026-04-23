export interface OutreachSyncInput {
    landingCampaignId: string;
    linkedCampaignId?: string | null;
    teamId: string;
}

export interface OutreachSyncResult {
    status: "stub" | "ok" | "error";
    details?: string;
}

export class OutreachSyncAdapter {
    async sync(_input: OutreachSyncInput): Promise<OutreachSyncResult> {
        return {
            status: "stub",
            details: "Outreach sync adapter is not configured for this environment.",
        };
    }
}
