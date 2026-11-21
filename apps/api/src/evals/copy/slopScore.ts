// A rule-based "AI slop" score for one outbound message. It is free and repeatable, so it can run
// on every variant in an A/B test next to the (paid, noisy) rubric judge. Lower is better: 0 is a
// message with none of the tells, 100 is saturated with them.
//
// The built-in list is deliberately generic and short. Your own phrase list belongs in the private
// eval folder (slop.json, an array of strings) and is passed in as `extraPhrases`.

export interface SlopHit {
    rule: "stock-phrase" | "em-dash" | "not-just-but" | "exclamation" | "too-long";
    match: string;
    points: number;
}

export interface SlopResult {
    score: number;
    hits: SlopHit[];
}

export interface SlopOptions {
    extraPhrases?: string[];
    maxBodyWords?: number;
}

const STOCK_PHRASES = [
    "i hope this email finds you well",
    "i hope this finds you well",
    "i hope this message finds you well",
    "i wanted to reach out",
    "i am reaching out",
    "i'm reaching out",
    "i came across your profile",
    "touch base",
    "circle back",
    "pick your brain",
    "game-changer",
    "game changer",
    "revolutionize",
    "cutting-edge",
    "state-of-the-art",
    "in today's fast-paced",
    "in today's digital landscape",
    "unlock the power",
    "take your business to the next level",
    "seamless",
    "synergy",
    "delve",
    "leverage",
    "tapestry",
];

const POINTS = { stockPhrase: 15, emDash: 8, notJustBut: 12, exclamation: 5, tooLong: 15 };
const DEFAULT_MAX_BODY_WORDS = 120;

function escapeRegExp(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole-word match on both sides; `u` so letters outside ASCII count as word characters.
function phraseRegex(phrase: string) {
    return new RegExp(`(?<![\\p{L}\\p{N}_])${escapeRegExp(phrase)}(?![\\p{L}\\p{N}_])`, "giu");
}

export function scoreSlop(message: { subject: string; body: string }, options: SlopOptions = {}): SlopResult {
    const text = `${message.subject}\n${message.body}`;
    const hits: SlopHit[] = [];

    for (const phrase of [...STOCK_PHRASES, ...(options.extraPhrases ?? [])]) {
        for (const m of text.matchAll(phraseRegex(phrase))) {
            hits.push({ rule: "stock-phrase", match: m[0], points: POINTS.stockPhrase });
        }
    }
    for (const m of text.matchAll(/—|–/g)) hits.push({ rule: "em-dash", match: m[0], points: POINTS.emDash });
    for (const m of text.matchAll(/\bnot (?:just|only|merely)\b[^.!?\n]{0,60}?\bbut\b/giu)) {
        hits.push({ rule: "not-just-but", match: m[0], points: POINTS.notJustBut });
    }
    for (const m of text.matchAll(/!/g)) hits.push({ rule: "exclamation", match: m[0], points: POINTS.exclamation });

    const words = message.body.trim().split(/\s+/).filter(Boolean).length;
    const max = options.maxBodyWords ?? DEFAULT_MAX_BODY_WORDS;
    if (words > max) hits.push({ rule: "too-long", match: `${words} words`, points: POINTS.tooLong });

    const score = Math.min(100, hits.reduce((sum, h) => sum + h.points, 0));
    return { score, hits };
}

export function parseExtraPhrases(raw: unknown): string[] {
    if (!Array.isArray(raw)) throw new Error("slop.json must be an array of strings.");
    return raw.map((item) => {
        if (typeof item !== "string" || !item.trim()) throw new Error("slop.json entries must be non-empty strings.");
        return item.trim();
    });
}
