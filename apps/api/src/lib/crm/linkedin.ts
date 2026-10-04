// Mirrors apps/web/src/lib/crm/linkedin.ts - keep the two files in sync (the
// parity test in apps/web checks they produce the same output).
//
// Every Lead.linkedIn profile URL is stored in one form,
// https://www.linkedin.com/in/<handle>/ with the handle lowercased, so a lead
// captured by the Chrome extension finds the same person imported from a CSV
// (which arrives as http://www.linkedin.com/in/<handle>, in.linkedin.com/...,
// or with no scheme). Migration 20261020120000_extension_lead_pipeline put
// existing rows in this form with the same rule.

const PROFILE_PATTERN = /^(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([^/?#\s]+)/i;

// The profile handle, or null when the value isn't a LinkedIn profile URL.
export function linkedInHandle(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const match = value.trim().match(PROFILE_PATTERN);
    return match?.[1] ? match[1].toLowerCase() : null;
}

// The stored form of a profile URL, or null when the value isn't one.
export function canonicalLinkedInProfileUrl(value: unknown): string | null {
    const handle = linkedInHandle(value);
    return handle ? `https://www.linkedin.com/in/${handle}/` : null;
}

// For a Lead.linkedIn write: profile URLs in the stored form, anything else
// (a company page, free text) trimmed and kept as it was given.
export function linkedInForStorage<T extends string | null | undefined>(value: T): T | string {
    if (typeof value !== "string") return value;
    return canonicalLinkedInProfileUrl(value) ?? value.trim();
}
