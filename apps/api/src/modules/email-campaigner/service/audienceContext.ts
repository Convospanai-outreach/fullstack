import { prisma } from "@/lib/db";

// Who the campaign targets (the saved ICP), where this prospect is and how they like to be written
// to (Crystal guidance), as a short block for the draft prompts. Plain facts only: AUDIENCE_RULES
// tells the model how to use them.
//
// ICPs are saved in two shapes: the ICP builder page stores { industry, role, size, painPoints,
// geographies, ... } and the agent tools store { industries, buyerTitles, companySizes, ... }. The
// older matcher shape { industries, jobTitles, companySize: {min,max} } is read too.

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

// A list of strings, or one string that may hold a comma/semicolon separated list.
function list(value: unknown, max: number): string[] {
    const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,;]/) : [];
    return raw
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .slice(0, max)
        .map((v) => clip(v.trim(), 60));
}

const first = (c: Record<string, unknown>, keys: string[], max: number): string[] => {
    for (const k of keys) {
        const v = list(c[k], max);
        if (v.length) return v;
    }
    return [];
};

function sizeText(c: Record<string, unknown>): string | undefined {
    const s = c["companySize"] as { min?: unknown; max?: unknown } | undefined;
    if (s && typeof s === "object" && typeof s.min === "number" && typeof s.max === "number") return `${s.min}-${s.max} employees`;
    const text = first(c, ["size", "companySizes"], 3);
    return text.length ? text.join(", ") : undefined;
}

export interface AudienceInput {
    icp?: { name?: string | null; description?: string | null; criteria?: unknown } | null;
    lead?: { location?: string | null; regionId?: string | null; enrichedData?: unknown } | null;
}

// What Crystal says about how to write to this person. Archetype/type and a clipped guidance line.
function communicationStyle(enrichedData: unknown): string | undefined {
    const guidance = (enrichedData as { crystalKnows?: { guidance?: { archetype?: unknown; discType?: unknown; prompt?: unknown } } } | null)
        ?.crystalKnows?.guidance;
    if (!guidance) return undefined;
    const label = [guidance.archetype, typeof guidance.discType === "string" && guidance.discType ? `DISC ${guidance.discType}` : ""]
        .filter((v): v is string => typeof v === "string" && v.trim() !== "")
        .join(", ");
    const prompt = typeof guidance.prompt === "string" ? clip(guidance.prompt.trim(), 300) : "";
    const text = [label, prompt].filter(Boolean).join(". ");
    return text || undefined;
}

// Undefined when there is nothing to say, so a prompt without an audience is unchanged.
export function buildAudienceContext({ icp, lead }: AudienceInput): string | undefined {
    const lines: string[] = [];
    const location = lead?.location?.trim();
    let targetMarkets: string[] = [];

    if (icp) {
        const c = (icp.criteria && typeof icp.criteria === "object" ? icp.criteria : {}) as Record<string, unknown>;
        const industries = first(c, ["industries", "industry"], 5);
        const roles = first(c, ["buyerTitles", "jobTitles", "role"], 5);
        const size = sizeText(c);
        targetMarkets = first(c, ["geographies", "geography"], 6);
        if (icp.name?.trim()) lines.push(`Target audience: ${clip(icp.name.trim(), 80)}`);
        if (icp.description?.trim()) lines.push(`About them: ${clip(icp.description.trim(), 200)}`);
        if (industries.length) lines.push(`Industries: ${industries.join(", ")}`);
        if (roles.length) lines.push(`Typical roles: ${roles.join(", ")}`);
        if (size) lines.push(`Company size: ${size}`);
        if (targetMarkets.length) lines.push(`Target markets: ${targetMarkets.join(", ")}`);
    }

    if (location) lines.push(`Prospect location: ${clip(location, 80)}`);
    else if (targetMarkets.length) lines.push(`Prospect location: not known (campaign targets ${targetMarkets.join(", ")})`);
    if (lead?.regionId && lead.regionId !== "GLOBAL") lines.push(`Prospect market: ${lead.regionId}`);

    const style = communicationStyle(lead?.enrichedData);
    if (style) lines.push(`Communication style: ${style}`);

    return lines.length ? lines.join("\n") : undefined;
}

// The campaign's ICP and the lead's own facts, both read inside the caller's team. Never throws:
// a drafting call must not fail because the audience could not be looked up.
export async function loadAudienceContext(teamId: string, ids: { leadId?: string; campaignId?: string }): Promise<string | undefined> {
    try {
        const [lead, campaign] = await Promise.all([
            ids.leadId
                ? prisma.lead.findFirst({ where: { id: ids.leadId, teamId }, select: { location: true, regionId: true, enrichedData: true, campaign: { select: { icp: true } } } })
                : null,
            ids.campaignId
                ? prisma.campaign.findFirst({ where: { id: ids.campaignId, teamId }, select: { icp: true } })
                : null,
        ]);
        return buildAudienceContext({ icp: campaign?.icp ?? lead?.campaign?.icp ?? null, lead });
    } catch (error) {
        console.warn("[Audience] Lookup unavailable, drafting without it", error instanceof Error ? error.message : error);
        return undefined;
    }
}
