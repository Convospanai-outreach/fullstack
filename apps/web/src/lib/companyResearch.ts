// What company research costs a team, shown next to the campaign switch. The same numbers live in
// apps/api/src/modules/email-campaigner/research/companyResearch.ts, which does the charging.
//
// One fixed charge per company researched fresh; free when the team already researched the same
// company website in the last 14 days. A failed pull is refunded. The charge is not the research
// provider's own unit (about 7 of its credits per company, roughly a cent), so a free-plan team
// is not drained by it.
export const COMPANY_RESEARCH_CREDITS = 1;
export const RESEARCH_TTL_DAYS = 14;

const credits = (n: number) => `${n} credit${n === 1 ? "" : "s"}`;

export function researchCostLines(leadCount: number): string[] {
    const lines = [
        `Costs ${credits(COMPANY_RESEARCH_CREDITS)} per new company researched. Free if your team already researched that company in the last ${RESEARCH_TTL_DAYS} days. A failed lookup is refunded.`,
    ];
    if (leadCount > 0) lines.push(`Worst case for this campaign's ${leadCount} lead${leadCount === 1 ? "" : "s"}: up to ${credits(leadCount * COMPANY_RESEARCH_CREDITS)} (less when leads share a company).`);
    return lines;
}
