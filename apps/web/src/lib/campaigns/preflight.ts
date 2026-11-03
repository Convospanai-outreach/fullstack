// Pre-flight brief: seven questions a campaign should be able to answer before anything is written. It
// is ready when every question has an answer. It only reports what is missing; it does not judge the
// answers or block anything.

export const PREFLIGHT_QUESTIONS = [
    { key: "idealReaderPersona", label: "Who is the ideal reader?", hint: "One person, not a market: role, situation, what they care about." },
    { key: "urgentPainPoint", label: "What urgent problem do they have?", hint: "The one they would pay to stop having." },
    { key: "failedStatusQuo", label: "What have they tried that has not worked?", hint: "What they do today, and why it falls short." },
    { key: "uniqueMechanism", label: "What is your different way of solving it?", hint: "How your approach works, in a sentence." },
    { key: "authorityProof", label: "What proof shows it works?", hint: "A result, a customer, a number, a credential." },
    { key: "clearActionPrompt", label: "What one action should they take?", hint: "Reply, book, click. Only one." },
    { key: "riskReversal", label: "What takes the risk off them?", hint: "A guarantee, a trial, a cancel-anytime." },
] as const;

export type PreflightKey = (typeof PREFLIGHT_QUESTIONS)[number]["key"];
export type PreflightBrief = Partial<Record<PreflightKey, string>>;

export const MAX_PREFLIGHT_ANSWER_CHARS = 500;

export interface PreflightStatus {
    ready: boolean;
    answered: number;
    // Keys of the unanswered questions, in question order.
    missing: PreflightKey[];
}

export function preflightStatus(brief: PreflightBrief | null | undefined): PreflightStatus {
    const missing = PREFLIGHT_QUESTIONS.filter((q) => !(brief?.[q.key] ?? "").trim()).map((q) => q.key);
    return { ready: missing.length === 0, answered: PREFLIGHT_QUESTIONS.length - missing.length, missing };
}

// Reads a brief from a request or a saved config: known keys only, text only, trimmed and clipped.
// Null when the value is not an object, or holds a non-text answer.
export function sanitizePreflight(value: unknown): PreflightBrief | null {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const input = value as Record<string, unknown>;
    const brief: PreflightBrief = {};
    for (const q of PREFLIGHT_QUESTIONS) {
        const answer = input[q.key];
        if (answer === undefined || answer === null) continue;
        if (typeof answer !== "string") return null;
        const text = answer.trim().slice(0, MAX_PREFLIGHT_ANSWER_CHARS);
        if (text) brief[q.key] = text;
    }
    return brief;
}
