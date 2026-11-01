// Words a connected domain's root already serves (the Worker's own routes and the app's paths), so a page
// address or A/B test path must not be one of them. Existing addresses are not changed.
// The web copy is RESERVED_PATHS in apps/web/src/components/landing-agent/landingPageAddress.ts; both copies
// are checked against apps/web/tests/fixtures/landing-reserved-paths.json. Keep them in step.
// robots.txt and favicon.ico are not listed: a page address cannot contain a dot.
export const RESERVED_PATHS: readonly string[] = ["api", "assets", "data-deletion", "event", "health", "landing-assets", "lead", "p", "thank-you", "track"];

export const RESERVED_PATH_MESSAGE = "That web address is reserved. Try another.";

export function isReservedPath(path: string): boolean {
    return RESERVED_PATHS.includes(path);
}
