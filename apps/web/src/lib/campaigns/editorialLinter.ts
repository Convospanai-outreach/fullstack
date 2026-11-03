// Editorial linter: reads an email as plain writing and flags three habits that weaken it: corporate
// jargon, talking about "we" more than "you", and too many links. It only advises; nothing blocks
// saving or sending. The score starts at 100 and loses points for each habit.

export const LINTER_LIMITS = {
    // Each jargon word costs this many points.
    jargonPenalty: 15,
    // More links than this costs linkPenalty.
    maxLinks: 3,
    linkPenalty: 15,
    // Fewer "you" than this many per "we" costs ratioPenalty.
    minYouToWe: 1.5,
    ratioPenalty: 20,
    passScore: 80,
} as const;

const JARGON = ["synergy", "circle back", "leverage", "touch base", "utilize", "paradigm shift"];

export interface LintResult {
    score: number;
    passed: boolean;
    // You-words per we-word, or null when the text uses neither.
    youToWe: number | null;
    jargon: string[];
    links: number;
    // Plain-language notes, one per habit found.
    findings: string[];
}

function plainText(input: string): string {
    return input
        .replace(/<[^>]*>/g, " ")
        .replace(/\{[^}]*\}/g, " ");
}

function countLinks(input: string): number {
    const urls = new Set<string>();
    for (const match of input.matchAll(/https?:\/\/[^\s)"'<>\]]+/gi)) urls.add(match[0].replace(/[.,;:!?]+$/, ""));
    return urls.size;
}

export function lintEmail(input: string): LintResult {
    const text = plainText(input);
    const jargon = JARGON.filter((word) => new RegExp(`\\b${word}\\b`, "i").test(text));
    const you = (text.match(/\b(you|your|yours)\b/gi) || []).length;
    const we = (text.match(/\b(we|our|ours|i|my|me)\b/gi) || []).length;
    const youToWe = you + we === 0 ? null : we === 0 ? you : Number((you / we).toFixed(2));
    const links = countLinks(input);

    const findings: string[] = [];
    let penalty = 0;
    if (jargon.length > 0) {
        penalty += jargon.length * LINTER_LIMITS.jargonPenalty;
        findings.push(`Jargon: ${jargon.map((w) => `"${w}"`).join(", ")}. Say it the way you would to a friend.`);
    }
    if (youToWe !== null && youToWe < LINTER_LIMITS.minYouToWe) {
        penalty += LINTER_LIMITS.ratioPenalty;
        findings.push(`The email says "you" ${you} time${you === 1 ? "" : "s"} and "we" or "I" ${we}. Aim for at least ${LINTER_LIMITS.minYouToWe} "you" for each "we".`);
    }
    if (links > LINTER_LIMITS.maxLinks) {
        penalty += LINTER_LIMITS.linkPenalty;
        findings.push(`${links} links. More than ${LINTER_LIMITS.maxLinks} splits attention and can look like spam; keep one clear action.`);
    }

    const score = Math.max(0, 100 - penalty);
    return { score, passed: score >= LINTER_LIMITS.passScore, youToWe, jargon, links, findings };
}
