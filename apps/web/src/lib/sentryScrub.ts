import type { Breadcrumb, Event } from "@sentry/nextjs";

// Scrubs personal data and credentials from everything apps/web sends to Sentry (server and
// browser). Mirrors apps/api/src/lib/sentry.ts. Imported by instrumentation-client.ts, so it
// must stay free of Node-only modules.

const URL_KEYS = new Set(["url", "url.full", "http.url", "http.target", "from", "to"]);
const DROPPED_KEYS = new Set(["http.query", "url.query", "http.client_ip", "client.address"]);
const MAX_DEPTH = 5;

const REDACTIONS: Array<[RegExp, string]> = [
    // Query strings on URLs inside text, and credential-like parameters anywhere.
    [/(https?:\/\/[^\s?#"']+)\?[^\s#"']*/g, "$1?[redacted]"],
    [/([?&](?:token|key|api_key|apikey|secret|code|password|signature|sig|access_token)=)[^&\s#"']+/gi, "$1[redacted]"],
    [/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [redacted]"],
    [/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[jwt]"],
    [/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]"],
    // International phone numbers (leading +). Bare digit runs are left alone so ids and
    // epoch timestamps survive.
    [/\+\d[\d\s().-]{6,}\d/g, "[phone]"],
    // Long opaque secrets (API keys, hex tokens). No hyphen, so UUIDs survive.
    [/\b[A-Za-z0-9_]{32,}\b/g, "[secret]"],
];

export function redactText(value: string): string {
    return REDACTIONS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
}

function stripQuery(value: unknown): unknown {
    return typeof value === "string" ? value.split("?")[0] : value;
}

function redactDeep(value: unknown, depth = 0): unknown {
    if (typeof value === "string") return redactText(value);
    if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map((item) => redactDeep(item, depth + 1));
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = redactDeep(item, depth + 1);
    return out;
}

function scrubData(data: Record<string, unknown> | undefined): void {
    if (!data) return;
    for (const key of Object.keys(data)) {
        if (DROPPED_KEYS.has(key) || key.startsWith("http.request.header.") || key.startsWith("http.response.header.")) {
            delete data[key];
        } else if (URL_KEYS.has(key)) {
            data[key] = stripQuery(data[key]);
        } else {
            data[key] = redactDeep(data[key]);
        }
    }
}

/**
 * Keeps only method + path of the request, and redacts emails, phone numbers, tokens and
 * query strings from messages, exception text, extras, tags and breadcrumbs. Drops captured
 * local variables, which can hold whole lead records.
 */
export function scrubEvent<T extends Event>(event: T): T {
    if (event.request) {
        const { method } = event.request;
        const url = stripQuery(event.request.url);
        event.request = { ...(method ? { method } : {}), ...(typeof url === "string" ? { url } : {}) };
    }
    if (typeof event.message === "string") event.message = redactText(event.message);
    for (const exception of event.exception?.values ?? []) {
        if (typeof exception.value === "string") exception.value = redactText(exception.value);
        for (const frame of exception.stacktrace?.frames ?? []) delete frame.vars;
    }
    if (event.extra) event.extra = redactDeep(event.extra) as Record<string, unknown>;
    if (event.tags) {
        for (const [key, tag] of Object.entries(event.tags)) {
            if (typeof tag === "string") event.tags[key] = redactText(tag);
        }
    }
    scrubData(event.contexts?.trace?.data as Record<string, unknown> | undefined);
    for (const span of event.spans ?? []) scrubData(span.data as Record<string, unknown> | undefined);
    for (const breadcrumb of event.breadcrumbs ?? []) {
        if (typeof breadcrumb.message === "string") breadcrumb.message = redactText(breadcrumb.message);
        scrubData(breadcrumb.data);
    }
    return event;
}

/** Console output is free text full of ids, emails and phone numbers: never sent. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
    if (breadcrumb.category === "console") return null;
    if (typeof breadcrumb.message === "string") breadcrumb.message = redactText(breadcrumb.message);
    scrubData(breadcrumb.data);
    return breadcrumb;
}

/**
 * Session replay custom events (navigation spans, breadcrumbs) carry page URLs, which can hold
 * invite and verification tokens. DOM snapshot events can't be changed by this hook.
 */
export function scrubRecordingEvent<T>(event: T): T {
    const record = event as { data?: { payload?: unknown } };
    if (record?.data && "payload" in record.data) {
        record.data.payload = redactDeep(record.data.payload);
    }
    return event;
}
