// A CSV "consent" cell counts only when it plainly says yes. Anything else, including blank, "unknown" and
// "not consented", is no consent. Mirrored byte for byte in apps/web/src/modules/governance/consentCell.ts.
const YES = new Set(["yes", "y", "true", "1", "consented", "opted in", "opt-in", "optin", "granted"]);

export function isAffirmative(value: string | null | undefined): boolean {
    if (typeof value !== "string") return false;
    return YES.has(value.trim().toLowerCase());
}
