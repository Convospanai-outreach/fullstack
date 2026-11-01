// Pure helpers for a landing page's public address (<domain>/<path>) and its path name.
// No DOM and no network: the list and the Settings page call these. The API checks the same path
// rule on save (apps/api/src/modules/landing-agent/schemas.ts), so keep the two patterns identical.

export const PAGE_PATH_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/;

// Keep in step with RESERVED_PATHS in apps/api/src/modules/landing-agent/reservedPaths.ts (both are checked
// against apps/web/tests/fixtures/landing-reserved-paths.json).
export const RESERVED_PATHS: readonly string[] = ["api", "assets", "event", "health", "landing-assets", "lead", "p", "thank-you", "track"];

export const RESERVED_PATH_MESSAGE = "That web address is reserved. Try another.";

export type PagePathResult = { ok: true; path: string } | { ok: false; error: string };

// A page's current address is accepted as it is, even a legacy one that breaks the rule (no-op save, as the API does).
export function validatePagePath(value: string, currentSlug?: string | null): PagePathResult {
    const path = value.trim().toLowerCase();
    if (currentSlug && path === currentSlug) return { ok: true, path };
    if (!PAGE_PATH_PATTERN.test(path)) {
        return { ok: false, error: "Use 2 to 63 letters, numbers or hyphens, starting with a letter or number." };
    }
    if (RESERVED_PATHS.includes(path)) return { ok: false, error: RESERVED_PATH_MESSAGE };
    return { ok: true, path };
}

// A page's public link: on the given connected domain, or on the app's own /p address without one.
export function pageLink(domain: string | null | undefined, slug: string): string {
    return domain ? `https://${domain}/${slug}` : `/p/${slug}`;
}

// The domain a page list shows and copies from: the preferred one when the team still has it, else the first.
export function shownDomain(domains: readonly string[], preferred: string | null | undefined): string | null {
    if (preferred && domains.includes(preferred)) return preferred;
    return domains[0] ?? null;
}

// The domain the list was last set to show. The browser does not know the team id, so this is one key per browser;
// a value that is not one of the team's domains is ignored by shownDomain, so another team's value does no harm.
export const SHOWN_DOMAIN_KEY = "cmf.landing.shownDomain";

type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

function browserStorage(): KeyValueStorage | undefined {
    try {
        return globalThis.localStorage;
    } catch {
        return undefined;
    }
}

// Storage can be blocked or full (private windows, cleared site data): then the choice is just not remembered.
export function readShownDomain(storage: KeyValueStorage | undefined = browserStorage()): string | null {
    try {
        return storage?.getItem(SHOWN_DOMAIN_KEY) ?? null;
    } catch {
        return null;
    }
}

export function writeShownDomain(domain: string, storage: KeyValueStorage | undefined = browserStorage()): void {
    try {
        storage?.setItem(SHOWN_DOMAIN_KEY, domain);
    } catch {
        // Not remembered; the list still shows the chosen domain for this visit.
    }
}
