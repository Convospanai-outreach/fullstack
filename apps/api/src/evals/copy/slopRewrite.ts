import type { DraftCopy } from "./runCopyEval";
import { scoreSlop, type SlopHit, type SlopOptions } from "./slopScore";

// A second pass over a finished draft that removes the slop tells scoreSlop found. A rewrite is
// model output, so it is checked before it is accepted: it must be valid, must not bring in a
// number or link the draft did not have, and must not grow. An invalid rewrite is an error, not a
// silent fall back to the original, so an A/B result never mixes rewritten and unrewritten drafts.

const MAX_GROWTH = 1.1;

export function buildRewritePrompt(draft: DraftCopy, hits: SlopHit[]): string {
    const tells = [...new Set(hits.map((h) => h.match.trim().toLowerCase()))].map((t) => `- ${t}`).join("\n");
    return [
        "Rewrite this outbound email so it reads like a person wrote it, not a template or a model.",
        "",
        "Remove or replace these tells:",
        tells,
        "",
        "Rules:",
        "- Keep the meaning, the sender's intent and every fact, name, number and link that is in the original.",
        "- Do not add claims, numbers, names, links or promises that are not in the original.",
        "- Same language. The same length or shorter. Plain words, short sentences, no em dashes, no exclamation marks.",
        "- Keep the call to action.",
        "",
        `Subject: ${draft.subject}`,
        draft.body,
        "",
        'Reply with JSON only: {"subject": "...", "body": "..."}',
    ].join("\n");
}

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const numbers = (s: string) => s.match(/\d[\d,.]*\d|\d/g) ?? [];
const links = (s: string) => s.match(/https?:\/\/[^\s)>"']+/gi) ?? [];

export function parseRewriteReply(raw: string, original: DraftCopy): DraftCopy {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    let parsed: any;
    try {
        if (start === -1 || end < start) throw new Error("no object");
        parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
        throw new Error("Rewrite reply was not valid JSON.");
    }
    if (typeof parsed?.subject !== "string" || !parsed.subject.trim()) throw new Error("Rewrite has no subject.");
    if (typeof parsed?.body !== "string" || !parsed.body.trim()) throw new Error("Rewrite has no body.");
    const out = { subject: parsed.subject.trim(), body: parsed.body.trim() };

    const before = `${original.subject}\n${original.body}`;
    const after = `${out.subject}\n${out.body}`;
    for (const n of numbers(after)) if (!numbers(before).includes(n)) throw new Error(`Rewrite added a number that was not in the draft: ${n}.`);
    for (const l of links(after)) if (!links(before).includes(l)) throw new Error(`Rewrite added a link that was not in the draft: ${l}.`);
    if (wordCount(out.body) > wordCount(original.body) * MAX_GROWTH) throw new Error("Rewrite is longer than the draft.");
    return out;
}

export async function rewriteDraft(
    draft: DraftCopy,
    ask: (prompt: string) => Promise<string>,
    slop?: SlopOptions,
): Promise<{ draft: DraftCopy; rewritten: boolean }> {
    const { hits } = scoreSlop(draft, slop);
    // Nothing to fix: spend no call and change nothing.
    if (hits.length === 0) return { draft, rewritten: false };
    return { draft: parseRewriteReply(await ask(buildRewritePrompt(draft, hits)), draft), rewritten: true };
}
