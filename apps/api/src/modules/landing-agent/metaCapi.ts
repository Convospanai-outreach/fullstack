import { createHash } from "crypto";

// Pure Meta Conversions API helpers for landing-page leads: normalization and SHA-256 hashing of customer data
// (as Meta's Customer Information Parameters page requires), and the payload for one website Lead event.
// No I/O here; the sender and the job handler live elsewhere.

const MAX_EVENT_AGE_SECONDS = 6 * 24 * 60 * 60; // Meta rejects a whole batch with an event older than 7 days.
const MAX_CLOCK_SKEW_SECONDS = 300;

export function normalizeEmail(value: string): string {
    return value.trim().toLowerCase();
}

// Digits only, no leading zeros. The country code must already be in the number (Meta asks for it).
export function normalizePhone(value: string): string {
    return value.replace(/\D/g, "").replace(/^0+/, "");
}

// Lowercase, no punctuation or symbols, single spaces. Letters in any script are kept (Meta encodes them as UTF-8).
export function normalizeName(value: string): string {
    return value.normalize("NFC").toLowerCase().replace(/[\p{P}\p{S}]/gu, "").replace(/\s+/g, " ").trim();
}

function sha256Hex(normalized: string): string {
    return createHash("sha256").update(normalized, "utf8").digest("hex");
}

function hashNormalized(normalized: string): string | undefined {
    return normalized ? sha256Hex(normalized) : undefined;
}

export function hashEmail(value: string | undefined): string | undefined {
    return value === undefined ? undefined : hashNormalized(normalizeEmail(value));
}

export function hashPhone(value: string | undefined): string | undefined {
    return value === undefined ? undefined : hashNormalized(normalizePhone(value));
}

export function hashName(value: string | undefined): string | undefined {
    return value === undefined ? undefined : hashNormalized(normalizeName(value));
}

// The lead form has one name box. First word is the first name, last word the last name (none when it is one word).
export function splitName(name: string | undefined): { firstName?: string; lastName?: string } {
    const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return {};
    if (parts.length === 1) return { firstName: parts[0] };
    return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

// Meta drops a batch that holds an event older than 7 days; we keep a margin and never send future-stamped events.
export function isEventTimeSendable(eventTime: number, nowSeconds: number): boolean {
    const age = nowSeconds - eventTime;
    return age <= MAX_EVENT_AGE_SECONDS && age >= -MAX_CLOCK_SKEW_SECONDS;
}

export interface LeadEventInput {
    // Same ID the browser Pixel sends as eventID for this submit, so Meta keeps one event.
    eventId: string;
    eventTime: number; // Unix seconds
    eventSourceUrl: string;
    email?: string;
    name?: string;
    phone?: string;
    clientIp?: string;
    clientUserAgent?: string;
    fbc?: string;
    fbp?: string;
    testEventCode?: string;
}

export interface MetaUserData {
    em?: string[];
    ph?: string[];
    fn?: string[];
    ln?: string[];
    client_ip_address?: string;
    client_user_agent?: string;
    fbc?: string;
    fbp?: string;
}

export interface MetaLeadEventPayload {
    data: Array<{
        event_name: "Lead";
        event_time: number;
        event_id: string;
        event_source_url: string;
        action_source: "website";
        user_data: MetaUserData;
    }>;
    test_event_code?: string;
}

export function buildLeadEvent(input: LeadEventInput): MetaLeadEventPayload {
    const { firstName, lastName } = splitName(input.name);
    const userData: MetaUserData = {};
    const em = hashEmail(input.email);
    const ph = hashPhone(input.phone);
    const fn = hashName(firstName);
    const ln = hashName(lastName);
    if (em) userData.em = [em];
    if (ph) userData.ph = [ph];
    if (fn) userData.fn = [fn];
    if (ln) userData.ln = [ln];
    if (input.clientIp) userData.client_ip_address = input.clientIp;
    if (input.clientUserAgent) userData.client_user_agent = input.clientUserAgent;
    if (input.fbc) userData.fbc = input.fbc;
    if (input.fbp) userData.fbp = input.fbp;

    const payload: MetaLeadEventPayload = {
        data: [
            {
                event_name: "Lead",
                event_time: input.eventTime,
                event_id: input.eventId,
                event_source_url: input.eventSourceUrl,
                action_source: "website",
                user_data: userData,
            },
        ],
    };
    if (input.testEventCode) payload.test_event_code = input.testEventCode;
    return payload;
}
