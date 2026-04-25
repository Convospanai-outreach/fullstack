export type AISurface = "CHAT" | "HELPER" | "EMAIL" | "LANDING" | "GENERIC";

const SURFACE_MAX_PROMPT_CHARS: Record<AISurface, number> = {
    CHAT: 5000,
    HELPER: 4500,
    EMAIL: 7000,
    LANDING: 9000,
    GENERIC: 6000,
};

const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    {
        pattern: /\b(ignore|disregard|bypass)\s+(all\s+)?(previous|prior)\s+(instructions?|rules?)\b/i,
        reason: "Prompt override attempts are not allowed.",
    },
    {
        pattern: /\b(system\s+prompt|developer\s+message|hidden\s+instructions?|jailbreak)\b/i,
        reason: "System-instruction extraction attempts are not allowed.",
    },
    {
        pattern: /\b(do\s+anything\s+now|DAN)\b/i,
        reason: "Jailbreak phrasing is not allowed.",
    },
];

const HIGH_RISK_CONTENT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
    {
        pattern: /<script[\s\S]*?>|<\/script>|javascript:|onerror\s*=|onload\s*=/i,
        reason: "Script payloads are not allowed in AI generation input.",
    },
    {
        pattern: /\b(ransomware|sqlmap|xss|csrf|credential\s+steal|token\s+steal|phishing\s+kit)\b/i,
        reason: "High-risk malicious instructions are not allowed.",
    },
];

function normalizeWhitespace(input: string): string {
    return input.replace(/\r\n/g, "\n").trim();
}

function countUrls(input: string): number {
    const matches = input.match(/https?:\/\/[^\s]+/gi);
    return matches?.length || 0;
}

export function resolveSurfaceFromTaskType(taskType?: string): AISurface {
    const normalized = (taskType || "").toUpperCase();
    if (!normalized) return "GENERIC";
    if (normalized.includes("EMAIL")) return "EMAIL";
    if (normalized.includes("CRITIQUE")) return "EMAIL";
    if (normalized.includes("LANDING")) return "LANDING";
    if (normalized.includes("CHAT")) return "CHAT";
    if (normalized.includes("REPLY")) return "CHAT";
    if (normalized.includes("HELPER")) return "HELPER";
    return "GENERIC";
}

export function enforceAIPromptPolicy(
    prompt: string,
    options: {
        surface?: AISurface;
        maxChars?: number;
        label?: string;
    } = {}
): string {
    if (typeof prompt !== "string") {
        throw new Error("AI prompt must be a string.");
    }

    const surface = options.surface || "GENERIC";
    const label = options.label || "AI prompt";
    const normalized = normalizeWhitespace(prompt);

    if (!normalized) {
        throw new Error(`${label} is required.`);
    }

    const maxChars = options.maxChars || SURFACE_MAX_PROMPT_CHARS[surface];
    if (normalized.length > maxChars) {
        throw new Error(`${label} exceeds ${maxChars} characters.`);
    }

    for (const rule of PROMPT_INJECTION_PATTERNS) {
        if (rule.pattern.test(normalized)) {
            throw new Error(rule.reason);
        }
    }

    for (const rule of HIGH_RISK_CONTENT_PATTERNS) {
        if (rule.pattern.test(normalized)) {
            throw new Error(rule.reason);
        }
    }

    if ((surface === "EMAIL" || surface === "LANDING" || surface === "HELPER") && /```[\s\S]*```/.test(normalized)) {
        throw new Error("Code-block payloads are not allowed for this generator.");
    }

    if (countUrls(normalized) > 12) {
        throw new Error("Too many external URLs in AI prompt.");
    }

    return normalized;
}

export function clampGeneratedText(text: string, maxChars: number): string {
    const normalized = normalizeWhitespace(String(text || ""));
    if (!normalized) return "";
    if (normalized.length <= maxChars) return normalized;
    return normalized.slice(0, maxChars);
}
