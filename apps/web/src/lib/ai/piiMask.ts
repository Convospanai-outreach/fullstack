import { randomBytes } from "node:crypto";

// DPDP: personal data is replaced with reversible placeholders before text goes to a cloud model, and put back
// in the model's output. The placeholder map lives only inside one masker, for one request: it is never logged,
// stored or put in an error. Off unless LLM_PII_MASKING is exactly "on", so enabling it is a deliberate step.
//
// Mirrored byte for byte in apps/web/src/lib/ai/piiMask.ts (a parity test keeps the two equal).

export class PiiMaskingError extends Error {
    constructor(message = "Personal data could not be masked, so the AI request was not sent. Try again, or contact support.") {
        super(message);
        this.name = "PiiMaskingError";
    }
}

export function piiMaskingEnabled(): boolean {
    return process.env["LLM_PII_MASKING"] === "on";
}

type Kind = "EMAIL" | "PAN" | "AADHAAR" | "PHONE" | "NAME";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PAN = /\b[A-Z]{5}\d{4}[A-Z]\b/gi;
// 12 digits starting 2-9, plain or in groups of four. A longer run of digits is not an Aadhaar.
const AADHAAR = /(?<!\d)[2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g;
// Indian mobile: 10 digits starting 6-9, with an optional +91, 91 or 0 in front and an optional gap in the middle.
const PHONE = /(?<!\d)(?:(?:\+91|91|0)[\s-]?)?[6-9]\d{4}[\s-]?\d{5}(?!\d)/g;
// The value of a labelled name field ("fullName: Meera Iyer", "Recipient Name: Meera"). Capitalised words on one line.
const LABELLED_NAME = /\b(?:[Ff]ull|[Ff]irst|[Ll]ast|[Cc]ontact|[Rr]ecipient|[Ll]ead)[ _-]?[Nn]ame["']?[ \t]*[:=][ \t]*["']?([A-Z][\p{L}'.-]*(?:[ \t]+[A-Z][\p{L}'.-]*){0,3})/gu;

const MIN_NAME_PART = 3;

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function createPiiMasker(options: { names?: string[] } = {}) {
    const nonce = randomBytes(4).toString("hex");
    const tokenOf = new Map<string, string>(); // kind + exact text -> token
    const originalOf = new Map<string, string>(); // token -> exact text
    const counters: Record<string, number> = {};
    const names = new Set<string>();
    for (const n of options.names ?? []) {
        if (typeof n === "string" && n.trim()) names.add(n.trim());
    }

    function tokenFor(kind: Kind, value: string): string {
        const key = `${kind}\u0000${value}`;
        const existing = tokenOf.get(key);
        if (existing) return existing;
        counters[kind] = (counters[kind] ?? 0) + 1;
        const token = `<${kind}_${counters[kind]}_${nonce}>`;
        tokenOf.set(key, token);
        originalOf.set(token, value);
        return token;
    }

    function mask(text: string): string {
        if (typeof text !== "string") throw new TypeError("mask expects a string");

        let out = text;
        out = out.replace(EMAIL, (m) => tokenFor("EMAIL", m));
        out = out.replace(PAN, (m) => tokenFor("PAN", m));
        out = out.replace(AADHAAR, (m) => tokenFor("AADHAAR", m));
        out = out.replace(PHONE, (m) => tokenFor("PHONE", m));

        // Names: the ones the caller knows, plus the values of labelled name fields in this text.
        for (const m of text.matchAll(LABELLED_NAME)) names.add(m[1]!.trim());
        const phrases = new Set<string>();
        for (const name of names) {
            phrases.add(name);
            for (const part of name.split(/\s+/)) if (part.length >= MIN_NAME_PART) phrases.add(part);
        }
        if (phrases.size > 0) {
            const alternation = [...phrases].sort((a, b) => b.length - a.length).map(escapeRegExp).join("|");
            out = out.replace(new RegExp(`\\b(?:${alternation})\\b`, "giu"), (m) => tokenFor("NAME", m));
        }
        return out;
    }

    function restore(text: string): string {
        if (typeof text !== "string") throw new TypeError("restore expects a string");
        const restored = text.replace(/<[A-Z]+_\d+_[0-9a-f]{8}>/g, (token) => originalOf.get(token) ?? token);
        // A placeholder the model changed so it can no longer be put back would reach the reader as junk.
        if (restored.includes(nonce)) {
            throw new PiiMaskingError("The AI reply contained a placeholder that could not be restored, so it was not used. Try again.");
        }
        return restored;
    }

    return { mask, restore };
}

export type LLMMasked = { prompt: string; systemPrompt: string | undefined; restore: (text: string) => string };

// The one wrapper every cloud model call goes through. Fails closed: if masking cannot be done, nothing is
// returned to send, and the caller must not call the model.
export function maskForLLM(input: { prompt: string; systemPrompt?: string | undefined }, names?: string[]): LLMMasked {
    if (!piiMaskingEnabled()) {
        return { prompt: input.prompt, systemPrompt: input.systemPrompt, restore: (text) => text };
    }
    try {
        const masker = createPiiMasker(names ? { names } : {});
        const prompt = masker.mask(input.prompt);
        const systemPrompt = input.systemPrompt === undefined ? undefined : masker.mask(input.systemPrompt);
        return { prompt, systemPrompt, restore: masker.restore };
    } catch {
        throw new PiiMaskingError();
    }
}
