// DPDP: a person who never filled in a form (imported, found, typed in) is told on the first message who is
// writing, why, how to stop and whom to ask about their data. Behind the team flag DPDP_FIRST_TOUCH_NOTICE (default off).

// Lead.source is free text and written differently by each importer ("csv_import", "netjana-intel", "Manual"...),
// so the origins are matched by name rather than by exact value.
const NO_FORM_CONSENT_SOURCE = /csv|hunter|netjana|manual/i;

export const DEFAULT_FIRST_TOUCH_NOTICE_TEXT = "[EDIT ME] You are receiving this because ... (say why you are contacting this person).";

const PLACEHOLDER = "[EDIT ME]";

export function firstTouchNoticeEnabled(sendSafety: unknown): boolean {
    return !!sendSafety && typeof sendSafety === "object" && (sendSafety as Record<string, unknown>)["DPDP_FIRST_TOUCH_NOTICE"] === true;
}

export function needsFirstTouchNotice(source: string | null | undefined): boolean {
    return typeof source === "string" && NO_FORM_CONSENT_SOURCE.test(source);
}

export type FirstTouchNotice = { text: string; privacyContactEmail: string };

// The team's own notice and privacy contact, from Team.branding. Null until both are set and the text is no
// longer the placeholder, so the placeholder can never reach a recipient.
export function resolveFirstTouchNotice(branding: unknown): FirstTouchNotice | null {
    if (!branding || typeof branding !== "object") return null;
    const b = branding as Record<string, unknown>;
    const text = typeof b["firstTouchNoticeText"] === "string" ? b["firstTouchNoticeText"].trim() : "";
    const email = typeof b["privacyContactEmail"] === "string" ? b["privacyContactEmail"].trim() : "";
    if (!text || text.includes(PLACEHOLDER) || !email || !email.includes("@")) return null;
    return { text, privacyContactEmail: email };
}
