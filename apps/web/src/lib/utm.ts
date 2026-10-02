// UTM tags on every outbound link CMf creates, so a landing visit, sign-up or purchase can be
// traced back to the post, DM, comment or sequence that sent it (creator funnel attribution).
// Mirror of apps/api/src/lib/utm.ts (apps/web can't import apps/api); tests/unit/utm-parity.test.ts
// keeps the two the same.

export type UtmSource = "instagram" | "facebook" | "linkedin" | "whatsapp" | "email";
export type UtmMedium = "post" | "dm" | "comment" | "sequence";

export type Utm = {
    source: UtmSource;
    medium: UtmMedium;
    campaign?: string | null; // playbook, campaign or trigger id
    content?: string | null; // content post or sequence step id
};

/**
 * Adds the UTM params to an absolute http(s) URL. A param the URL already has is kept (creators
 * add their own), as are other params (like ?t=) and the fragment. Anything else comes back as is.
 */
export function withUtm(url: string, utm: Utm): string {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return url;
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return url;
    const values: [string, string | null | undefined][] = [
        ["utm_source", utm.source],
        ["utm_medium", utm.medium],
        ["utm_campaign", utm.campaign],
        ["utm_content", utm.content],
    ];
    for (const [key, value] of values) {
        if (value && !parsed.searchParams.has(key)) parsed.searchParams.set(key, value);
    }
    return parsed.toString();
}

const UTM_MAX = 200;

/** The utm_* params of a URL's query, trimmed and capped, for storing next to an event or order. */
export function readUtm(params: URLSearchParams) {
    const get = (key: string) => params.get(key)?.trim().slice(0, UTM_MAX) || undefined;
    return {
        utmSource: get("utm_source"),
        utmMedium: get("utm_medium"),
        utmCampaign: get("utm_campaign"),
        utmTerm: get("utm_term"),
        utmContent: get("utm_content"),
    };
}
