// Team-defined custom properties on a lead (Phase 10). Pure rules only: no database access here.
// Values live in Lead.customFields as a JSON object keyed by property key.

export const LEAD_PROPERTY_TYPES = ["text", "number", "choice", "yesno", "date"] as const;
export type LeadPropertyType = (typeof LEAD_PROPERTY_TYPES)[number];

export const LEAD_PROPERTY_KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
// Form fields with these keys already fill a lead column (or are the honeypot), so a property cannot use them.
export const RESERVED_PROPERTY_KEYS = ["name", "email", "phone", "company", "title", "website"] as const;
export const MAX_LEAD_PROPERTIES_PER_TEAM = 50;
export const MAX_PROPERTY_LABEL_CHARS = 100;
export const MAX_CHOICE_OPTIONS = 50;
export const MAX_CHOICE_OPTION_CHARS = 100;
export const MAX_PROPERTY_VALUE_CHARS = 1000;
export const MAX_CUSTOM_FIELDS_CHARS = 10000;

const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface PropertyDefinition {
    key: string;
    type: LeadPropertyType;
    options: string[] | null;
    archivedAt: Date | null;
}

export type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export function validatePropertyKey(key: string): string | null {
    if (!LEAD_PROPERTY_KEY_PATTERN.test(key)) {
        return "Key must start with a lowercase letter and use only lowercase letters, numbers and underscores (up to 32 characters)";
    }
    if ((RESERVED_PROPERTY_KEYS as readonly string[]).includes(key)) {
        return `"${key}" is used by the lead form itself. Pick another key`;
    }
    return null;
}

export function validatePropertyDefinition(input: {
    key: string;
    label: string;
    type: string;
    options?: unknown;
}): Result<{ label: string; type: LeadPropertyType; options: string[] | null }> {
    const keyError = validatePropertyKey(input.key);
    if (keyError) return { ok: false, message: keyError };
    const label = input.label.trim();
    if (!label || label.length > MAX_PROPERTY_LABEL_CHARS) {
        return { ok: false, message: `Label must be 1 to ${MAX_PROPERTY_LABEL_CHARS} characters` };
    }
    if (!(LEAD_PROPERTY_TYPES as readonly string[]).includes(input.type)) {
        return { ok: false, message: "Type must be text, number, choice, yesno or date" };
    }
    const type = input.type as LeadPropertyType;
    if (type !== "choice") {
        if (input.options !== undefined && input.options !== null) {
            return { ok: false, message: "Only choice properties have options" };
        }
        return { ok: true, value: { label, type, options: null } };
    }
    const options = checkOptions(input.options);
    if (!options.ok) return options;
    return { ok: true, value: { label, type, options: options.value } };
}

function checkOptions(raw: unknown): Result<string[]> {
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CHOICE_OPTIONS) {
        return { ok: false, message: `A choice property needs 1 to ${MAX_CHOICE_OPTIONS} options` };
    }
    const options: string[] = [];
    for (const option of raw) {
        if (typeof option !== "string") return { ok: false, message: "Options must be text" };
        const trimmed = option.trim();
        if (!trimmed || trimmed.length > MAX_CHOICE_OPTION_CHARS) {
            return { ok: false, message: `Each option must be 1 to ${MAX_CHOICE_OPTION_CHARS} characters` };
        }
        if (options.includes(trimmed)) return { ok: false, message: "Options must be unique" };
        options.push(trimmed);
    }
    return { ok: true, value: options };
}

function isRealDate(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

// Coerces one submitted value to the property's type. Returns the value to store.
export function coercePropertyValue(
    definition: Pick<PropertyDefinition, "key" | "type" | "options">,
    raw: unknown,
): Result<string | number | boolean> {
    const fail = (message: string): Result<never> => ({ ok: false, message: `${definition.key}: ${message}` });
    switch (definition.type) {
        case "text": {
            if (typeof raw !== "string") return fail("must be text");
            const value = raw.trim();
            if (!value) return fail("is empty");
            if (value.length > MAX_PROPERTY_VALUE_CHARS) return fail(`must be at most ${MAX_PROPERTY_VALUE_CHARS} characters`);
            return { ok: true, value };
        }
        case "number": {
            const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
            if (!NUMBER_PATTERN.test(text)) return fail("must be a number");
            const value = Number(text);
            if (!Number.isFinite(value)) return fail("must be a number");
            return { ok: true, value };
        }
        case "choice": {
            if (typeof raw !== "string" || !(definition.options ?? []).includes(raw.trim())) {
                return fail("must be one of the options");
            }
            return { ok: true, value: raw.trim() };
        }
        case "yesno": {
            if (raw === true || raw === "true") return { ok: true, value: true };
            if (raw === false || raw === "false") return { ok: true, value: false };
            return fail("must be yes or no");
        }
        case "date": {
            if (typeof raw !== "string" || !isRealDate(raw)) return fail("must be a date as YYYY-MM-DD");
            return { ok: true, value: raw };
        }
    }
}

function activeByKey(definitions: PropertyDefinition[]): Map<string, PropertyDefinition> {
    return new Map(definitions.filter((definition) => !definition.archivedAt).map((definition) => [definition.key, definition]));
}

// Applies a settings-style patch from a lead editor. null removes the key. Unknown, archived or
// wrong-typed keys reject the whole patch. Keys that are not in the patch are kept as they were.
export function applyCustomFieldsPatch(
    definitions: PropertyDefinition[],
    existing: Record<string, unknown>,
    patch: Record<string, unknown>,
): Result<Record<string, unknown>> {
    const active = activeByKey(definitions);
    const next: Record<string, unknown> = { ...existing };
    for (const [key, raw] of Object.entries(patch)) {
        const definition = active.get(key);
        if (!definition) return { ok: false, message: `Unknown property: ${key}` };
        if (raw === null) {
            delete next[key];
            continue;
        }
        const coerced = coercePropertyValue(definition, raw);
        if (!coerced.ok) return coerced;
        next[key] = coerced.value;
    }
    if (JSON.stringify(next).length > MAX_CUSTOM_FIELDS_CHARS) {
        return { ok: false, message: "These properties are too large to save" };
    }
    return { ok: true, value: next };
}

// Form answers (landing lead form) whose key matches an active property. Other answers are ignored.
export function pickPropertyAnswers(
    definitions: PropertyDefinition[],
    answers: Record<string, unknown>,
): { values: Record<string, string | number | boolean>; errors: { key: string; message: string }[] } {
    const active = activeByKey(definitions);
    const values: Record<string, string | number | boolean> = {};
    const errors: { key: string; message: string }[] = [];
    for (const [key, raw] of Object.entries(answers)) {
        const definition = active.get(key);
        if (!definition) continue;
        const coerced = coercePropertyValue(definition, raw);
        if (coerced.ok) values[key] = coerced.value;
        else errors.push({ key, message: coerced.message });
    }
    return { values, errors };
}
