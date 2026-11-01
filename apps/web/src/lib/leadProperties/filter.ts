// Builds the Prisma filter for the leads list's custom-property filter (a URL query on the server-rendered list).
// The value is turned into the JSON type stored on the lead. This is filter shaping only: values are
// never written from here, so a bad filter can only match nothing. The same number and date rules
// live in apps/api/src/modules/lead-properties/leadProperties.ts (apps/web cannot import from apps/api).

export interface FilterDefinition {
    key: string;
    type: string;
    options: string[] | null;
}

export type FilterOperator = "equals" | "contains";

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,31}$/;
const NUMBER_PATTERN = /^-?\d+(\.\d+)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_FILTER_VALUE_CHARS = 200;

export type FilterResult = { ok: true; where: Record<string, unknown> } | { ok: false; message: string };

function isRealDate(value: string): boolean {
    if (!DATE_PATTERN.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function leadPropertyFilterWhere(definition: FilterDefinition, operator: string, rawValue: string): FilterResult {
    if (!KEY_PATTERN.test(definition.key)) return { ok: false, message: "Unknown property" };
    const value = rawValue.trim();
    if (!value || value.length > MAX_FILTER_VALUE_CHARS) return { ok: false, message: "Enter a value to filter by" };
    const path = [definition.key];

    if (operator === "contains") {
        if (definition.type !== "text") return { ok: false, message: "Contains works on text properties only" };
        // Postgres JSON string_contains is case-sensitive.
        return { ok: true, where: { customFields: { path, string_contains: value } } };
    }
    if (operator !== "equals") return { ok: false, message: "Unknown filter" };

    switch (definition.type) {
        case "text":
            return { ok: true, where: { customFields: { path, equals: value } } };
        case "choice":
            if (!(definition.options ?? []).includes(value)) return { ok: false, message: "Not one of the options" };
            return { ok: true, where: { customFields: { path, equals: value } } };
        case "number":
            if (!NUMBER_PATTERN.test(value)) return { ok: false, message: "Enter a number" };
            return { ok: true, where: { customFields: { path, equals: Number(value) } } };
        case "yesno":
            if (value !== "true" && value !== "false") return { ok: false, message: "Enter true or false" };
            return { ok: true, where: { customFields: { path, equals: value === "true" } } };
        case "date":
            if (!isRealDate(value)) return { ok: false, message: "Enter a date as YYYY-MM-DD" };
            return { ok: true, where: { customFields: { path, equals: value } } };
        default:
            return { ok: false, message: "Unknown property type" };
    }
}
