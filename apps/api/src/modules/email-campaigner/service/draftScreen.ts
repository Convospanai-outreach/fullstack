import { judgeOutreachDraft, NOUL_NO } from "@/lib/ai/jev";
import { enforceMultilineGuardrails } from "@/lib/ai/agentOutputGuardrails";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";

// An optional screen in front of the critic. Off unless JEV_SCREEN=on. Jev (a typed-question model)
// judges the draft against what is known about the prospect; a draft it confidently calls clean skips
// the paid critique call. Jev only supplies judgments. The decision is the table below, in code.
//
//   code checks fail                          -> not clean (the critic runs; Jev is not called)
//   every judgment at or below NOUL_NO        -> clean (critic skipped, recorded as "screened")
//   any judgment above NOUL_NO                -> not clean (the critic runs)
//   Jev can't answer (no key, error, timeout) -> not clean (the critic runs)
//
// So the worst case is today's behaviour, and a Jev outage never lets a draft through unchecked.
// What goes to TypeSafe: the prospect's role, company and signal facts and the draft (which may greet
// the prospect by first name). Emails and phone numbers are masked locally before sending; names are
// masked too when the edge node is reachable. Bump JEV_SCREEN_REF (copyProvenance.ts) when the
// questions in jev.ts or the threshold here change.

export function jevScreenEnabled(): boolean {
    return process.env["JEV_SCREEN"] === "on";
}

// What the critic's own rewrite guard checks, applied to the draft itself: a number or a certainty
// word with no support in the facts, or a raw contact detail, means a person-like check is needed.
const RAW_CONTACT = /[^\s@]+@[^\s@]+\.[^\s@]+|\+?\d[\d\s().-]{7,}\d/;

function codeChecksPass(prospect: Record<string, string | undefined>, draft: { subject: string; body: string }): boolean {
    if (RAW_CONTACT.test(draft.subject) || RAW_CONTACT.test(draft.body)) return false;
    const options = { sourceContext: Object.values(prospect).filter(Boolean).join("\n"), strictGrounding: true };
    return enforceMultilineGuardrails(draft.body, options).issues.length === 0 && enforceMultilineGuardrails(draft.subject, options).issues.length === 0;
}

// True only when the draft is judged clean. Never throws.
export async function screenDraft(
    prospect: Record<string, string | undefined>,
    draft: { subject: string; body: string },
    teamId: string,
): Promise<boolean> {
    if (!codeChecksPass(prospect, draft)) return false;
    try {
        const facts = Object.fromEntries(Object.entries(prospect).filter(([, v]) => typeof v === "string" && v.trim()) as [string, string][]);
        // Masked as one document so the same value gets the same token in the facts and the draft.
        const masked = await SovereignFirewall.mask(JSON.stringify({ prospect: facts, draft: { subject: draft.subject, body: draft.body } }), "GLOBAL", undefined, { alwaysMask: true });
        const state = JSON.parse(masked.safeContext);
        const judgment = await judgeOutreachDraft(state, teamId);
        return Math.max(judgment.inventsFact, judgment.readsAsPitch, judgment.hardAsk) <= NOUL_NO;
    } catch (error) {
        console.warn("[Screen] Jev could not screen the draft; the critic will run", { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}
