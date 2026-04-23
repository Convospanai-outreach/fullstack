export interface LeadEnrichmentInput {
    landingLeadId: string;
    teamId: string;
    email?: string;
    company?: string;
}

export interface LeadEnrichmentResult {
    status: "stub" | "ok" | "error";
    details?: string;
}

export class LeadEnrichmentAdapter {
    async enrich(_input: LeadEnrichmentInput): Promise<LeadEnrichmentResult> {
        return {
            status: "stub",
            details: "Lead enrichment adapter is not configured for this environment.",
        };
    }
}
