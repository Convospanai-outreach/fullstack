import { leadFormConsentRequired, type LeadFormConfig, type LeadFormConsent } from "./leadFormConfig";

// Consent for a landing form lead. The customer owns the lead and the consent wording; this module only
// records the visitor's answer. A record lives in LandingLead.rawPayload.consent, written by the server only.

export const LEAD_CONSENT_SOURCE = "landing_form";

export interface LeadConsentRecord {
  given: boolean;
  text: string;
  at: string;
  pageSlug: string;
  source: typeof LEAD_CONSENT_SOURCE;
}

export type ConsentMode = "none" | "optional" | "required";

// The consent box mode of a form, used by the Worker lead script (no box, an optional box, or a required one).
export function consentModeOf(consent: LeadFormConsent | undefined): ConsentMode {
  if (!consent?.enabled) return "none";
  return leadFormConsentRequired(consent) ? "required" : "optional";
}

// True when the form needs a ticked box and the submission does not have one.
export function consentMissing(config: LeadFormConfig, submitted: boolean | undefined): boolean {
  return leadFormConsentRequired(config.consent) && submitted !== true;
}

// The record for this submission, or null when the form has no consent box switched on.
export function consentRecordFor(config: LeadFormConfig, submitted: boolean | undefined, pageSlug: string, now: Date): LeadConsentRecord | null {
  if (!config.consent?.enabled) return null;
  return { given: submitted === true, text: config.consent.text, at: now.toISOString(), pageSlug, source: LEAD_CONSENT_SOURCE };
}

// The record read back from a stored rawPayload, or null when there is none or it is malformed.
export function consentRecordOf(rawPayload: unknown): LeadConsentRecord | null {
  if (!rawPayload || typeof rawPayload !== "object") return null;
  const record = (rawPayload as { consent?: unknown }).consent;
  if (!record || typeof record !== "object") return null;
  const fields = record as Record<string, unknown>;
  if (
    typeof fields["given"] !== "boolean" ||
    typeof fields["text"] !== "string" ||
    typeof fields["at"] !== "string" ||
    typeof fields["pageSlug"] !== "string" ||
    fields["source"] !== LEAD_CONSENT_SOURCE
  ) {
    return null;
  }
  return fields as unknown as LeadConsentRecord;
}

// Whether automatic messages and the Meta event may be sent for this lead: yes when the page had no consent box,
// and only when consent was given otherwise. An entry that cannot be read counts as not given.
export function consentAllowsContact(rawPayload: unknown): boolean {
  if (!rawPayload || typeof rawPayload !== "object" || !("consent" in rawPayload)) return true;
  return consentRecordOf(rawPayload)?.given === true;
}

// A visitor's own rawPayload cannot carry a consent entry: only the server writes one.
export function withoutConsentRecord(rawPayload: unknown): unknown {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload) || !("consent" in rawPayload)) return rawPayload;
  const rest = { ...(rawPayload as Record<string, unknown>) };
  delete rest["consent"];
  return rest;
}
