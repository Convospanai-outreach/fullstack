export type GuardrailSeverity = "warning" | "block";

export interface GuardrailIssue {
    code: "APPEASEMENT" | "ABSOLUTE_CLAIM" | "UNGROUNDED_NUMERIC" | "UNGROUNDED_REFERENCE";
    severity: GuardrailSeverity;
    detail: string;
}

export interface GuardrailOptions {
    sourceContext?: string;
    strictGrounding?: boolean;
}

export interface GuardrailResult {
    text: string;
    issues: GuardrailIssue[];
}

const APPEASEMENT_PATTERNS: RegExp[] = [
    /\b(you(?:'re| are)\s+(absolutely|totally|completely)\s+right)\b/gi,
    /\b(i\s+fully\s+agree\s+with\s+you)\b/gi,
    /\b(great\s+point,\s+you(?:'re| are)\s+right)\b/gi,
    /\b(you're\s+a\s+genius)\b/gi,
    /\b(perfect,\s+i(?:'ll| will)\s+do\s+exactly\s+that)\b/gi
];

const ABSOLUTE_CLAIM_PATTERNS: RegExp[] = [
    /\bguarantee(?:d|s|ing)?\b/gi,
    /\b(always|never)\b/gi,
    /\b(100%\s*(certain|sure|guaranteed))\b/gi,
    /\b(definitely|certainly|undoubtedly)\b/gi
];

const UNGROUNDED_REFERENCE_PATTERNS: RegExp[] = [
    /\baccording to our data\b/gi,
    /\bour internal benchmarks show\b/gi,
    /\bresearch confirms\b/gi
];

const NUMBER_PATTERN = /(?:\$?\d[\d,]*(?:\.\d+)?%?)/g;

function normalizeNumberToken(value: string): string {
    return value.replace(/[$,%\s,]/g, "").trim().toLowerCase();
}

function getContextNumberSet(sourceContext: string): Set<string> {
    const matches = sourceContext.match(NUMBER_PATTERN) || [];
    return new Set(matches.map(normalizeNumberToken));
}

function sanitizeSentence(
    sentence: string,
    options: GuardrailOptions,
    contextNumbers: Set<string>,
    issues: GuardrailIssue[]
): string {
    let next = sentence;

    for (const pattern of APPEASEMENT_PATTERNS) {
        if (pattern.test(next)) {
            issues.push({
                code: "APPEASEMENT",
                severity: "warning",
                detail: "Removed appeasing language to keep output objective."
            });
            next = next.replace(pattern, "I understand the request");
        }
    }

    for (const pattern of ABSOLUTE_CLAIM_PATTERNS) {
        if (pattern.test(next)) {
            issues.push({
                code: "ABSOLUTE_CLAIM",
                severity: "warning",
                detail: "Softened certainty language to avoid over-promising."
            });
            next = next.replace(pattern, "likely");
        }
    }

    for (const pattern of UNGROUNDED_REFERENCE_PATTERNS) {
        if (pattern.test(next)) {
            issues.push({
                code: "UNGROUNDED_REFERENCE",
                severity: "block",
                detail: "Removed ungrounded reference claim."
            });
            next = "";
        }
    }

    if (options.strictGrounding) {
        const sentenceNumbers = (next.match(NUMBER_PATTERN) || []).map(normalizeNumberToken);
        if (sentenceNumbers.some((token) => token.length > 0 && !contextNumbers.has(token))) {
            issues.push({
                code: "UNGROUNDED_NUMERIC",
                severity: "block",
                detail: "Removed numeric claim not present in the provided context."
            });
            next = "";
        }
    }

    return next.trim();
}

export function enforceAgentOutputGuardrails(
    rawText: string,
    options: GuardrailOptions = {}
): GuardrailResult {
    const sourceContext = options.sourceContext || "";
    const strictGrounding = options.strictGrounding ?? true;
    const issues: GuardrailIssue[] = [];
    const contextNumbers = getContextNumberSet(sourceContext);

    const sentences = rawText
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sanitizeSentence(sentence, { sourceContext, strictGrounding }, contextNumbers, issues))
        .filter((sentence) => sentence.length > 0);

    const cleaned = sentences.join(" ").trim();
    if (cleaned.length > 0) {
        return { text: cleaned, issues };
    }

    return {
        text: "I do not have enough grounded evidence in the provided context to make that claim.",
        issues
    };
}

export function sanitizeStructuredOutput<T>(
    value: T,
    options: GuardrailOptions = {}
): T {
    if (typeof value === "string") {
        return enforceAgentOutputGuardrails(value, options).text as T;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeStructuredOutput(entry, options)) as T;
    }

    if (value && typeof value === "object") {
        const next: Record<string, any> = {};
        for (const [key, entry] of Object.entries(value as Record<string, any>)) {
            next[key] = sanitizeStructuredOutput(entry, options);
        }
        return next as T;
    }

    return value;
}

export function getAgentGuardrailPrefix(): string {
    return `
Agent Safety Rules (mandatory):
1) Grounding first: only state facts present in provided context or user input.
2) If data is missing, explicitly say it is unknown and ask for evidence.
3) No hallucinated metrics, dates, references, customer names, or benchmarks.
4) No appeasement language; remain objective and evidence-focused.
5) No guaranteed outcomes or absolute certainty claims.
`.trim();
}

