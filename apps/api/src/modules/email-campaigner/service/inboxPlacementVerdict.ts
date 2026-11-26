// Pure rules for the inbox placement check (no I/O, so they are unit tested on their own).
// The check sends one copy of a campaign email to a few test inboxes the operator owns and reads where each copy
// landed. A handful of test inboxes only loosely predicts placement for real recipients, so "green" means
// "no problem found", never "guaranteed inbox".
import { randomBytes } from "node:crypto";
import type { DkimProofVerdict } from "./dkimProof";

export type PlacementFolder = "inbox" | "promotions" | "spam" | "missing" | "error";
export type InboxProvider = "gmail" | "yahoo" | "other";
export type PlacementLevel = "green" | "amber" | "red";

export interface PlacementInboxResult {
    // The test inbox's row id, never its address: this state is stored on the customer's mailbox.
    inbox: string;
    provider: InboxProvider;
    folder: PlacementFolder;
    auth: DkimProofVerdict | null;
    error?: string;
}

export interface PlacementVerdict {
    level: PlacementLevel;
    reasons: string[];
}

// A verdict older than this no longer says anything about today's sending.
export const PLACEMENT_FRESH_DAYS = 14;
const DAY_MS = 86_400_000;

export function inboxProviderFromHost(host: string): InboxProvider {
    const h = host.trim().toLowerCase();
    // Whole-label matches only, so a host like "fakeyahoo.com" is not taken for Yahoo.
    if (h === "gmail.com" || h.endsWith(".gmail.com") || h === "googlemail.com" || h.endsWith(".googlemail.com")) return "gmail";
    if (h === "yahoo.com" || h.endsWith(".yahoo.com")) return "yahoo";
    return "other";
}

// Folder names differ per provider ("[Gmail]/Spam", Yahoo "Bulk", "Junk E-mail"), so prefer the \Junk special-use
// flag the server advertises and fall back to the name.
export function isSpamFolder(folder: { path: string; specialUse?: string | null; flags?: Set<string> | null }): boolean {
    if (folder.specialUse === "\\Junk" || folder.flags?.has("\\Junk")) return true;
    const name = folder.path.split(/[/.]/).pop()?.toLowerCase() ?? "";
    return name === "spam" || name === "junk" || name === "junk e-mail" || name === "junk email" || name === "bulk" || name === "bulk mail";
}

// One plain word, so IMAP BODY search finds it on every server, and nothing in the subject changes.
export function placementToken(): string {
    return `ref${randomBytes(6).toString("hex")}`;
}

// DMARC or DKIM failing is red. A missing or third-party DKIM signature while DMARC still passes (for example Google
// Workspace before a custom DKIM key is set up) is accepted by providers, so it is amber, not a reason to block.
function authProblem(auth: DkimProofVerdict): { level: "red" | "amber"; text: string } | null {
    if (auth.dmarc === "fail") return { level: "red", text: "DMARC fails" };
    if (auth.dkim === "fail") return { level: "red", text: "the DKIM signature fails" };
    if (auth.dkim !== "pass") return { level: "amber", text: "no DKIM signature from your domain. Set up DKIM for it" };
    if (!auth.aligned) return { level: "amber", text: "DKIM is signed by another domain, not yours. Set up DKIM for your domain" };
    if (auth.spf === "fail") return { level: "amber", text: "SPF fails" };
    return null;
}

export function placementVerdict(results: readonly PlacementInboxResult[], checkedAt: Date | null, now = new Date()): PlacementVerdict {
    if (!checkedAt || results.length === 0) return { level: "amber", reasons: ["No inbox placement check has run yet."] };
    if (now.getTime() - checkedAt.getTime() > PLACEMENT_FRESH_DAYS * DAY_MS) {
        return { level: "amber", reasons: [`The last check is older than ${PLACEMENT_FRESH_DAYS} days. Run it again.`] };
    }

    const red: string[] = [];
    const amber: string[] = [];
    for (const r of results) {
        if (r.folder === "spam") red.push(`${label(r.provider)} put the email in spam.`);
        if (r.auth) {
            const problem = authProblem(r.auth);
            if (problem) (problem.level === "red" ? red : amber).push(`${label(r.provider)}: ${problem.text}.`);
        }
        if (r.folder === "promotions") amber.push(`${label(r.provider)} put the email in Promotions.`);
        if (r.folder === "missing") amber.push(`${label(r.provider)} did not receive the email within the wait time.`);
        if (r.folder === "error") amber.push(`${label(r.provider)} test inbox could not be read${r.error ? ` (${r.error})` : ""}.`);
    }
    if (red.length) return { level: "red", reasons: [...red, ...amber] };
    if (results.every((r) => r.folder === "missing")) {
        return { level: "amber", reasons: ["None of the test copies arrived. The receiving servers may have rejected them: check the mailbox's DNS records and sending status, then run the check again."] };
    }

    const landed = results.filter((r) => r.folder === "inbox");
    const providers = new Set(landed.map((r) => r.provider));
    if (providers.size < 2) amber.push("Fewer than two different providers received the email in the inbox. Add test inboxes at more providers.");
    if (amber.length) return { level: "amber", reasons: amber };
    return { level: "green", reasons: ["No placement or authentication problem found at the test inboxes."] };
}

function label(provider: InboxProvider): string {
    return provider === "gmail" ? "Gmail" : provider === "yahoo" ? "Yahoo" : "A test inbox";
}
