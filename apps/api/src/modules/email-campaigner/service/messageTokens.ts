// Merge fields in email steps: {{firstName}}, {{company}}, {{property.<key>}}, with an optional fallback written
// in the step as {{firstName|there}}. A token with no value for a lead and no fallback is reported, never sent
// as literal text: the caller holds the email and shows the sender what is missing and what could be used.

export interface MissingToken {
    token: string; // as written, without the braces
    reason: "empty" | "unknown";
    // Something the sender can approve to send anyway, or null when it has to be fixed instead.
    suggestedFallback: string | null;
    advice: string;
}

export interface TokenLead {
    fullName?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    location?: string | null;
    customFields?: unknown;
}

interface Builtin {
    value: (lead: TokenLead) => string;
    fallback: string;
    label: string;
}

const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const words = (lead: TokenLead) => clean(lead.fullName).split(/\s+/).filter(Boolean);

const BUILTINS: Record<string, Builtin> = {
    firstname: { value: (l) => words(l)[0] ?? "", fallback: "there", label: "first name" },
    lastname: { value: (l) => (words(l).length > 1 ? words(l)[words(l).length - 1]! : ""), fallback: "", label: "last name" },
    fullname: { value: (l) => clean(l.fullName), fallback: "there", label: "full name" },
    company: { value: (l) => clean(l.company), fallback: "your company", label: "company" },
    companyname: { value: (l) => clean(l.company), fallback: "your company", label: "company" },
    jobtitle: { value: (l) => clean(l.jobTitle), fallback: "your role", label: "job title" },
    location: { value: (l) => clean(l.location), fallback: "your area", label: "location" },
};

const CANONICAL: Record<string, string> = {
    firstname: "firstName",
    lastname: "lastName",
    fullname: "fullName",
    company: "company",
    companyname: "companyName",
    jobtitle: "jobTitle",
    location: "location",
};

const TOKEN =/\{\{\s*([^{}|]+?)\s*(?:\|([^{}]*))?\}\}/g;

function propertyValue(lead: TokenLead, key: string): string {
    const fields = lead.customFields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) return "";
    // Property keys are stored lowercase, so {{property.PLAN}} finds the value saved under "plan".
    const value = (fields as Record<string, unknown>)[key.toLowerCase()];
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
}

function closestBuiltin(name: string): string | null {
    const lower = name.toLowerCase().replace(/[\s_-]/g, "");
    if (BUILTINS[lower]) return null; // matched by case alone, not a typo
    const names = Object.keys(BUILTINS);
    const hit = names.find((n) => n.startsWith(lower) || lower.startsWith(n) || (lower.length > 3 && n.includes(lower)));
    return hit ?? null;
}

const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export interface ResolveOptions {
    // Send missing tokens with the suggested fallback (the sender approved it). Never applies to unknown tokens
    // or ones with no usable suggestion.
    useSuggestedFallbacks?: boolean;
    // Lead data goes into HTML bodies escaped; subjects are plain text.
    html?: boolean;
}

export function resolveMessageTokens(text: string, lead: TokenLead, options: ResolveOptions = {}): { text: string; missing: MissingToken[] } {
    const missing: MissingToken[] = [];
    const seen = new Set<string>();
    const encode = options.html ? escapeHtml : (v: string) => v;

    const out = text.replace(TOKEN, (whole, rawName: string, rawFallback: string | undefined) => {
        const name = rawName.trim();
        const inlineFallback = rawFallback !== undefined ? rawFallback.trim() : null;
        const record = (entry: MissingToken) => {
            if (!seen.has(entry.token)) {
                seen.add(entry.token);
                missing.push(entry);
            }
        };

        let value = "";
        let suggested: string | null = null;
        let label = name;

        if (/^property\./i.test(name)) {
            const key = name.slice("property.".length).trim();
            if (!key) {
                record({ token: name, reason: "unknown", suggestedFallback: null, advice: `"${name}" names no property. Write {{property.<key>}} with the property's key.` });
                return whole;
            }
            value = propertyValue(lead, key);
            label = `property "${key}"`;
        } else {
            const builtin = BUILTINS[name.toLowerCase().replace(/[\s_-]/g, "")];
            if (!builtin) {
                const near = closestBuiltin(name);
                record({
                    token: name,
                    reason: "unknown",
                    suggestedFallback: null,
                    advice: near
                        ? `"${name}" is not a known field. Did you mean {{${CANONICAL[near]}}}?`
                        : `"${name}" is not a known field. Use firstName, lastName, fullName, company, jobTitle, location, or property.<key>.`,
                });
                return whole;
            }
            value = builtin.value(lead);
            suggested = builtin.fallback || null;
            label = builtin.label;
        }

        if (value) return encode(value);
        // The sender wrote a fallback in the step: that is their own choice, so it is used.
        if (inlineFallback) return encode(inlineFallback);

        record({
            token: name,
            reason: "empty",
            suggestedFallback: suggested,
            advice: suggested
                ? `This contact has no ${label}. Write {{${name}|${suggested}}} in the step, or approve sending with "${suggested}".`
                : `This contact has no ${label}. Fill it in on the contact, or write a fallback such as {{${name}|a value}} in the step.`,
        });
        if (options.useSuggestedFallbacks && suggested) return encode(suggested);
        return whole;
    });

    return { text: out, missing };
}
