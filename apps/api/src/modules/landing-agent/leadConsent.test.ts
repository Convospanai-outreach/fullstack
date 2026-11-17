import { describe, expect, it } from "vitest";
import { consentAllowsContact, consentMissing, consentModeOf, consentRecordFor, consentRecordOf, withoutConsentRecord } from "./leadConsent";
import type { LeadFormConfig } from "./leadFormConfig";

const NOW = new Date("2026-11-01T10:00:00.000Z");
const base = { fields: [{ key: "email", label: "Work email", type: "email", required: true }], buttonLabel: "Send", successMessage: "Thanks" };
const requiredForm = { ...base, consent: { enabled: true, text: "I agree." } } as LeadFormConfig;
const optionalForm = { ...base, consent: { enabled: true, required: false, text: "Send me tips." } } as LeadFormConfig;
const noConsent = { ...base } as LeadFormConfig;
const switchedOff = { ...base, consent: { enabled: false, text: "Not shown" } } as LeadFormConfig;

describe("consentRecordFor", () => {
  it("is null when the form has no consent block or it is switched off", () => {
    expect(consentRecordFor(noConsent, true, "guide", NOW)).toBeNull();
    expect(consentRecordFor(switchedOff, true, "guide", NOW)).toBeNull();
  });

  it("records consent given with the wording shown, the time, the page and the source", () => {
    expect(consentRecordFor(requiredForm, true, "guide", NOW)).toEqual({
      given: true,
      text: "I agree.",
      at: "2026-11-01T10:00:00.000Z",
      pageSlug: "guide",
      source: "landing_form",
    });
  });

  it("records consent not given when an optional box was left unticked", () => {
    expect(consentRecordFor(optionalForm, undefined, "guide", NOW)).toMatchObject({ given: false, text: "Send me tips." });
  });
});

describe("consentMissing", () => {
  it("is true only for a required consent that is not ticked", () => {
    expect(consentMissing(requiredForm, undefined)).toBe(true);
    expect(consentMissing(requiredForm, false)).toBe(true);
    expect(consentMissing(requiredForm, true)).toBe(false);
  });

  it("treats a required flag left out as required when consent is enabled", () => {
    expect(consentMissing(requiredForm, false)).toBe(true);
  });

  it("is false for an optional consent or no consent", () => {
    expect(consentMissing(optionalForm, false)).toBe(false);
    expect(consentMissing(noConsent, false)).toBe(false);
    expect(consentMissing(switchedOff, false)).toBe(false);
  });
});

describe("stored consent record", () => {
  it("reads a valid record back from rawPayload", () => {
    const record = { given: true, text: "I agree.", at: "2026-11-01T10:00:00.000Z", pageSlug: "guide", source: "landing_form" };
    expect(consentRecordOf({ answers: {}, consent: record })).toEqual(record);
  });

  it("returns null for a payload without a consent record or with a malformed one", () => {
    expect(consentRecordOf({ answers: { budget: "Over $5k" } })).toBeNull();
    expect(consentRecordOf({ consent: { given: "yes" } })).toBeNull();
    expect(consentRecordOf(null)).toBeNull();
  });

  it("allows contact when the page had no consent block, and only when consent was given otherwise", () => {
    expect(consentAllowsContact(null)).toBe(true);
    expect(consentAllowsContact({ answers: {} })).toBe(true);
    expect(consentAllowsContact({ consent: { given: true, text: "I agree.", at: "2026-11-01T10:00:00.000Z", pageSlug: "guide", source: "landing_form" } })).toBe(true);
    expect(consentAllowsContact({ consent: { given: false, text: "Send me tips.", at: "2026-11-01T10:00:00.000Z", pageSlug: "guide", source: "landing_form" } })).toBe(false);
  });

  it("fails closed on a consent entry it cannot read", () => {
    expect(consentAllowsContact({ consent: "given" })).toBe(false);
  });
});

describe("a visitor cannot send a consent record", () => {
  it("drops a consent entry from a visitor's own payload and keeps the rest", () => {
    expect(withoutConsentRecord({ consent: { given: true }, answers: { a: "b" } })).toEqual({ answers: { a: "b" } });
  });

  it("passes other payloads through unchanged", () => {
    expect(withoutConsentRecord(null)).toBeNull();
    expect(withoutConsentRecord({ answers: {} })).toEqual({ answers: {} });
  });
});

describe("consentModeOf", () => {
  it("is none without a switched-on consent box, optional or required otherwise", () => {
    expect(consentModeOf(undefined)).toBe("none");
    expect(consentModeOf({ enabled: false, text: "x" })).toBe("none");
    expect(consentModeOf({ enabled: true, text: "x" })).toBe("required");
    expect(consentModeOf({ enabled: true, required: false, text: "x" })).toBe("optional");
  });
});
