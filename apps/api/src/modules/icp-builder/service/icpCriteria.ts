// One reader for ICP criteria. ICPs are saved in three shapes: the ICP builder page stores
// { industry, role, size, geographies }, the agent tools store { industries, buyerTitles,
// companySizes }, and the lead matcher reads { industries, jobTitles, companySize: {min,max} }.
// Pure, no database import, so prompt builders can use it.

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

export interface IcpFacts {
    industries: string[];
    roles: string[];
    size?: string;
    geographies: string[];
}

export function readIcpCriteria(criteria: unknown): IcpFacts {
    const c = (criteria && typeof criteria === "object" && !Array.isArray(criteria) ? criteria : {}) as Record<string, unknown>;
    const s = c["companySize"] as { min?: unknown; max?: unknown } | undefined;
    const sizeList = first(c, ["size", "companySizes"], 3);
    const size = s && typeof s === "object" && typeof s.min === "number" && typeof s.max === "number" ? `${s.min}-${s.max} employees` : sizeList.length ? sizeList.join(", ") : undefined;
    return {
        industries: first(c, ["industries", "industry"], 5),
        roles: first(c, ["buyerTitles", "jobTitles", "role"], 5),
        ...(size ? { size } : {}),
        geographies: first(c, ["geographies", "geography"], 6),
    };
}

// What the ICP builder saves for the "Target Markets" box.
export function parseGeographies(text: string): string[] {
    return list(text, 6);
}
