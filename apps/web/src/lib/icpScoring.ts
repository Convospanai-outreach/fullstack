// Mirrors apps/api/src/modules/icp-builder/service/icpService.ts's scoreLead formula
// exactly. apps/web and apps/api are separate deployables sharing one database (no
// shared package for this), and this route already has the ICP row and the lead
// rows in hand - computing here avoids an apps/api round-trip per lead.
export function scoreLeadAgainstIcp(
    criteria: any,
    leadData: { industry?: string | null; jobTitle?: string | null; companySize?: number | null }
): number {
    let totalScore = 0;

    if (criteria?.industries?.length > 0) {
        if (criteria.industries.includes(leadData.industry)) totalScore += 30;
    } else {
        totalScore += 30;
    }

    if (criteria?.jobTitles?.length > 0) {
        const titleMatch = criteria.jobTitles.some((title: string) =>
            leadData.jobTitle?.toLowerCase().includes(title.toLowerCase())
        );
        if (titleMatch) totalScore += 40;
    } else {
        totalScore += 40;
    }

    if (criteria?.companySize) {
        const size = leadData.companySize;
        if (typeof size === "number" && size >= criteria.companySize.min && size <= criteria.companySize.max) {
            totalScore += 30;
        }
    } else {
        totalScore += 30;
    }

    return totalScore;
}

export function leadDataForIcpScoring(lead: { jobTitle?: string | null; enrichedData?: unknown }) {
    const enriched = (lead.enrichedData || {}) as Record<string, unknown>;
    return {
        jobTitle: lead.jobTitle ?? null,
        industry: typeof enriched["industry"] === "string" ? (enriched["industry"] as string) : null,
        companySize: typeof enriched["company_size"] === "number" ? (enriched["company_size"] as number) : null,
    };
}
