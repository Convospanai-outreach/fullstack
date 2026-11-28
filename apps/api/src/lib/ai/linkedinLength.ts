// LinkedIn rejects or cuts text over its limits: 300 characters for a connection note and
// a practical 600 for the follow-ups the prompts ask for. Model output that runs over is
// trimmed here at a sentence end, or else a word boundary, so a note never ends mid-word.
// Basic (free) accounts have a lower note limit (200); this does not know the account type.
import { clampGeneratedText } from "../aiInputGuardrails";

export type LinkedinKind = "connect" | "followUp";

export const LINKEDIN_LIMITS: Readonly<Record<LinkedinKind, number>> = { connect: 300, followUp: 600 };

// A sentence end is only worth cutting at if it keeps most of the text.
const MIN_KEPT_SHARE = 0.5;

export function fitLinkedinText(text: string, kind: LinkedinKind): string {
    const limit = LINKEDIN_LIMITS[kind];
    const normalized = clampGeneratedText(text, Number.MAX_SAFE_INTEGER);
    if (normalized.length <= limit) return normalized;

    const head = normalized.slice(0, limit + 1);
    const minKept = Math.floor(limit * MIN_KEPT_SHARE);

    let sentenceEnd = -1;
    for (const match of head.matchAll(/[.!?](?=\s|$)/g)) {
        if (match.index! + 1 <= limit) sentenceEnd = match.index! + 1;
    }
    if (sentenceEnd >= minKept) return normalized.slice(0, sentenceEnd).trim();

    const space = head.lastIndexOf(" ");
    if (space > 0) return normalized.slice(0, space).replace(/[\s,;:\-–—]+$/, "");
    return normalized.slice(0, limit);
}
