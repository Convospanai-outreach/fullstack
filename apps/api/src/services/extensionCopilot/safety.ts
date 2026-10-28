// Deterministic checks for the LinkedIn copilot extension's AI calls. They run before and after
// every model call, so they hold even when a model ignores its instructions.

const SENSITIVE: Array<[RegExp, string]> = [
    [/\b(lawyer|attorney|legal action|sue you|lawsuit|cease and desist)\b/i, "legal"],
    [/\b(suicid|kill myself|self[- ]harm|want to die)\b/i, "self-harm"],
    [/\b(diagnos|chemotherapy|my illness|hospitali[sz]ed|pregnan)\w*/i, "health"],
    [/\b(harass|threat(en)?|report you|scam(mer)?|fraud)\w*/i, "complaint"],
    [/\b(passport|social security|bank account|credit card|password)\b/i, "personal data"]
];
const INJECTION = /\b(ignore (all|previous|the above) (instructions|prompts?)|system prompt|you are (now )?(an? )?(ai|assistant|chatgpt|llm)|reveal your (prompt|instructions)|act as)\b/i;
const AI_TELLS = /\b(as an ai|as a language model|i am an ai|i'?m an ai|large language model)\b/i;
// aiService's output guardrail returns this when it strips every sentence: never a usable draft.
const GUARDRAIL_FALLBACK = /do not have enough grounded evidence/i;

export function sensitive(text: unknown): string | null {
    for (const [re, label] of SENSITIVE) if (re.test(String(text || ""))) return label;
    return null;
}

export const injection = (text: unknown): boolean => INJECTION.test(String(text || ""));

/** Problems with a draft before anyone may send it: [] when clean. */
export function draftProblems(text: unknown, maxLen = 1200): string[] {
    const t = String(text || "").trim();
    const out: string[] = [];
    if (!t) out.push("empty draft");
    if (t.length > maxLen) out.push("too long");
    if (AI_TELLS.test(t)) out.push("mentions being an AI");
    if (GUARDRAIL_FALLBACK.test(t)) out.push("guardrail fallback text");
    if (/\{[a-zA-Z]+\}|\[(name|company|your name)\]/i.test(t)) out.push("unfilled placeholder");
    return out;
}

/** Strips code fences, "Message:" labels and wrapping quotes that models like to add. */
export function cleanText(text: unknown): string {
    return String(text || "")
        .replace(/^```\w*\n?|```$/g, "")
        .replace(/^\s*(message|comment|reply|note)\s*:\s*/i, "")
        .replace(/^["“](.*)["”]$/s, "$1")
        .trim();
}

/** The first JSON object in a model answer, or null. */
export function parseJson(text: unknown): any {
    const s = String(text || "");
    try { return JSON.parse(s); } catch { /* look for an embedded object */ }
    const start = s.indexOf("{");
    for (let end = s.lastIndexOf("}"); start >= 0 && end > start; end = s.lastIndexOf("}", end - 1)) {
        try { return JSON.parse(s.slice(start, end + 1)); } catch { /* try a shorter span */ }
    }
    return null;
}
