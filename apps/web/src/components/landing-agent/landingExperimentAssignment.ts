// Pure A/B assignment for landing page experiments (phase 6B). The Worker and apps/web carry identical copies;
// the shared fixture apps/web/tests/fixtures/landing-ab-assignment.json pins the behaviour of all of them.
// No I/O: the caller passes the cookie header, the User-Agent, the do-not-track flag and one random draw in [0, 1).

export const AB_COOKIE_PREFIX = "cmf_ab_";
export const AB_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

// Crawlers and link-preview bots. They always get A, get no cookie, and are not counted.
const BOT_PATTERN = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse/i;

export interface AssignInput {
    experimentId: string;
    cookieHeader: string | null;
    weightA: number;
    userAgent: string | null;
    doNotTrack: boolean;
    draw: number;
}

export interface AssignResult {
    variant: "A" | "B";
    setCookie: string | null;
    counted: boolean;
}

function readCookie(cookieHeader: string | null, name: string): string | null {
    if (!cookieHeader) return null;
    for (const part of cookieHeader.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
    }
    return null;
}

export function isBotUserAgent(userAgent: string | null): boolean {
    return userAgent !== null && BOT_PATTERN.test(userAgent);
}

export function assignVariant(input: AssignInput): AssignResult {
    if (isBotUserAgent(input.userAgent)) {
        return { variant: "A", setCookie: null, counted: false };
    }
    const name = `${AB_COOKIE_PREFIX}${input.experimentId}`;
    const existing = readCookie(input.cookieHeader, name);
    // Do-not-track: no cookie is written and the visit is not counted. The cookie is still honoured if one exists.
    if (input.doNotTrack) {
        const variant = existing === "A" || existing === "B" ? existing : input.draw < input.weightA / 100 ? "A" : "B";
        return { variant, setCookie: null, counted: false };
    }
    if (existing === "A" || existing === "B") {
        return { variant: existing, setCookie: null, counted: true };
    }
    const variant = input.draw < input.weightA / 100 ? "A" : "B";
    const setCookie = `${name}=${variant}; Max-Age=${AB_COOKIE_MAX_AGE_SECONDS}; Path=/; Secure; SameSite=Lax`;
    return { variant, setCookie, counted: true };
}
