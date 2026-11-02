// How well a saved ICP suits the strategies on a campaign, and which strategies suit the ICP. An ICP
// says who the prospects are (roles, industries, company size, pain points), so it can only speak to
// how specific the audience is. Whether an audience opted in, or already uses the product, is a
// property of the lead source, not of the ICP, so those strategies get a reminder and are never
// suggested from an ICP.

export interface IcpFitNote {
    // The strategy the note is about.
    strategyId: string;
    level: "warning" | "info";
    text: string;
}

export interface IcpSuggestion {
    strategyId: string;
    reason: string;
}

export interface IcpFit {
    notes: IcpFitNote[];
    suggestions: IcpSuggestion[];
}

// Past these counts an ICP covers more than one audience.
export const ICP_LIMITS = { maxRoles: 5, maxIndustries: 3 } as const;

interface IcpShape {
    roles: number;
    industries: number;
    hasSize: boolean;
    hasPain: boolean;
}

function count(value: unknown): number {
    if (Array.isArray(value)) return value.filter((v) => typeof v === "string" && v.trim()).length;
    return typeof value === "string" && value.trim() ? 1 : 0;
}

function shapeOf(criteria: unknown): IcpShape {
    const c = typeof criteria === "object" && criteria !== null ? (criteria as Record<string, unknown>) : {};
    const size = c["companySize"] ?? c["size"];
    return {
        // The AI-generated lists win; the form's single answers are the fallback.
        roles: count(c["jobTitles"]) || count(c["role"]),
        industries: count(c["industries"]) || count(c["industry"]),
        hasSize: typeof size === "object" ? size !== null : count(size) > 0,
        hasPain: count(c["painPoints"]) > 0,
    };
}

// Defined enough to name one audience: a role, an industry, and one more detail.
function isSpecific(s: IcpShape): boolean {
    return s.roles >= 1 && s.industries >= 1 && (s.hasSize || s.hasPain) && s.roles <= ICP_LIMITS.maxRoles && s.industries <= ICP_LIMITS.maxIndustries;
}

function isBroad(s: IcpShape): boolean {
    const defined = [s.roles > 0, s.industries > 0, s.hasSize, s.hasPain].filter(Boolean).length;
    return defined <= 1 || s.roles > ICP_LIMITS.maxRoles || s.industries > ICP_LIMITS.maxIndustries;
}

function isOneAudience(s: IcpShape): boolean {
    return s.roles >= 1 && s.industries >= 1 && s.roles <= ICP_LIMITS.maxRoles && s.industries <= ICP_LIMITS.maxIndustries;
}

export function icpFit(criteria: unknown, strategies: readonly string[]): IcpFit {
    const shape = shapeOf(criteria);
    const notes: IcpFitNote[] = [];
    const suggestions: IcpSuggestion[] = [];
    const chosen = new Set(strategies);

    if (chosen.has("S10") && isBroad(shape)) {
        notes.push({
            strategyId: "S10",
            level: "warning",
            text: "This ICP is too wide to narrow. The broad-to-niche funnel needs a specific role in a specific situation: add a role, an industry and a company size or pain point.",
        });
    }
    if (chosen.has("S11") && (shape.roles > ICP_LIMITS.maxRoles || shape.industries > ICP_LIMITS.maxIndustries)) {
        notes.push({
            strategyId: "S11",
            level: "warning",
            text: `4-3-2-1 distribution expects one audience, and this ICP spans ${shape.roles} roles and ${shape.industries} industries. Split it into separate ICPs.`,
        });
    }
    if (chosen.has("S3")) {
        notes.push({ strategyId: "S3", level: "info", text: "Daily sends suit people who chose to hear from you. Check that the leads in this campaign opted in." });
    }
    for (const id of ["S1", "S6"]) {
        if (chosen.has(id)) {
            notes.push({ strategyId: id, level: "info", text: "This strategy is for people who already use the product. An ICP describes prospects, so use leads who have signed up." });
        }
    }

    if (!chosen.has("S10") && isSpecific(shape)) {
        suggestions.push({ strategyId: "S10", reason: "This ICP names a specific role and situation, which is what the broad-to-niche funnel narrows down to." });
    }
    if (!chosen.has("S11") && isOneAudience(shape)) {
        suggestions.push({ strategyId: "S11", reason: "This ICP is one audience, so a steady mix of useful sends with one clear offer fits it." });
    }

    return { notes, suggestions };
}
