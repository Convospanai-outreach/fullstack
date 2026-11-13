// Who the campaign targets (the saved ICP) and where this prospect is, as a short block for the
// Node A draft prompt. Plain facts only: the prompt tells the model how to use them.
// ICP criteria hold industries, job titles and company size; they have no geography, so location
// comes from the lead itself.

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max)}…` : text);

const strings = (value: unknown, max: number): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim() !== "").slice(0, max).map((v) => clip(v.trim(), 60)) : [];

export interface AudienceInput {
    icp?: { name?: string | null; description?: string | null; criteria?: unknown } | null;
    lead?: { location?: string | null; regionId?: string | null } | null;
}

// Undefined when there is nothing to say, so a prompt without an audience is unchanged.
export function buildAudienceContext({ icp, lead }: AudienceInput): string | undefined {
    const lines: string[] = [];

    if (icp) {
        const c = (icp.criteria && typeof icp.criteria === "object" ? icp.criteria : {}) as Record<string, unknown>;
        const industries = strings(c["industries"], 5);
        const titles = strings(c["jobTitles"], 5);
        const size = c["companySize"] as { min?: unknown; max?: unknown } | undefined;
        if (icp.name?.trim()) lines.push(`Target audience: ${clip(icp.name.trim(), 80)}`);
        if (icp.description?.trim()) lines.push(`About them: ${clip(icp.description.trim(), 200)}`);
        if (industries.length) lines.push(`Industries: ${industries.join(", ")}`);
        if (titles.length) lines.push(`Typical roles: ${titles.join(", ")}`);
        if (size && typeof size.min === "number" && typeof size.max === "number") lines.push(`Company size: ${size.min}-${size.max} employees`);
    }

    const location = lead?.location?.trim();
    if (location) lines.push(`Prospect location: ${clip(location, 80)}`);
    if (lead?.regionId && lead.regionId !== "GLOBAL") lines.push(`Prospect market: ${lead.regionId}`);

    return lines.length ? lines.join("\n") : undefined;
}

// Appended to the draft prompt only when an audience block exists.
export const AUDIENCE_RULES =
    "Use this only to pick the angle, vocabulary and level of formality. Write in the spelling and date style of the prospect's location when one is given, and keep the formality normal for business email there. " +
    "Do not mention the prospect's country, region, nationality, religion or culture unless the Signal does. No stereotypes and no assumptions about the person beyond these facts. Do not say the prospect fits the target audience.";
