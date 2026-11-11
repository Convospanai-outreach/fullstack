import { describe, expect, it } from "vitest";
import { mapLeadFormSubmission } from "./leadFormSubmit";
import type { LeadFormConfig } from "./leadFormConfig";

const config = {
  fields: [
    { key: "name", label: "Full name", type: "text", required: true },
    { key: "email", label: "Work email", type: "email", required: true },
    { key: "phone", label: "Phone", type: "tel", required: false },
    { key: "company", label: "Company", type: "text", required: false },
    { key: "title", label: "Job title", type: "text", required: false },
    { key: "goal", label: "Goal", type: "textarea", required: false },
    { key: "budget", label: "Budget", type: "select", required: true, options: ["Under $1k", "Over $5k"] },
    { key: "consent", label: "Send tips", type: "checkbox", required: false },
  ],
  buttonLabel: "Send",
  successMessage: "Thanks",
} as LeadFormConfig;

const valid = {
  name: "Ada",
  email: "ada@example.com",
  phone: "+91 98765 43210",
  company: "Analytical",
  title: "Engineer",
  goal: "Grow",
  budget: "Under $1k",
  consent: true,
};

function expectFail(result: ReturnType<typeof mapLeadFormSubmission>) {
  expect(result.ok).toBe(false);
  return result.ok ? "" : result.message;
}

describe("mapLeadFormSubmission", () => {
  it("puts name/email/phone/company/title in columns and the rest in rawPayload.answers", () => {
    const result = mapLeadFormSubmission(config, valid);
    expect(result).toEqual({
      ok: true,
      columns: { name: "Ada", email: "ada@example.com", phone: "+91 98765 43210", company: "Analytical", title: "Engineer" },
      rawPayload: { answers: { goal: "Grow", budget: "Under $1k", consent: true } },
    });
  });

  it("trims values and leaves out empty optional fields", () => {
    const result = mapLeadFormSubmission(config, { ...valid, company: "   ", goal: "  " });
    expect(result.ok && result.columns.company).toBeUndefined();
    expect(result.ok && result.rawPayload?.answers).toEqual({ budget: "Under $1k", consent: true });
  });

  it("rejects a field the page does not have", () => {
    expect(expectFail(mapLeadFormSubmission(config, { ...valid, admin: "yes" }))).toContain("admin");
  });

  it("rejects a missing required field, an unchecked required checkbox and an unknown select option", () => {
    expectFail(mapLeadFormSubmission(config, { ...valid, name: "" }));
    expectFail(mapLeadFormSubmission(config, { ...valid, email: undefined }));
    expectFail(mapLeadFormSubmission(config, { ...valid, budget: "Free" }));
    const needTerms = { ...config, fields: [...config.fields.slice(0, 7), { key: "consent", label: "Terms", type: "checkbox", required: true }] } as LeadFormConfig;
    expectFail(mapLeadFormSubmission(needTerms, { ...valid, consent: false }));
  });

  it("rejects an invalid email in the email field", () => {
    expectFail(mapLeadFormSubmission(config, { ...valid, email: "not-an-email" }));
  });

  it("rejects an answer over 1000 characters", () => {
    expectFail(mapLeadFormSubmission(config, { ...valid, goal: "x".repeat(1001) }));
    expect(mapLeadFormSubmission(config, { ...valid, goal: "x".repeat(1000) }).ok).toBe(true);
  });

  it("rejects a column value over its column limit", () => {
    expectFail(mapLeadFormSubmission(config, { ...valid, name: "x".repeat(201) }));
    expectFail(mapLeadFormSubmission(config, { ...valid, phone: "1".repeat(51) }));
  });

  it("rejects a value of the wrong type", () => {
    expectFail(mapLeadFormSubmission(config, { ...valid, goal: 42 }));
    expectFail(mapLeadFormSubmission(config, { ...valid, consent: "yes" }));
  });

  it("rejects answers that would push rawPayload past 10k characters once JSON-escaped", () => {
    // A 1000-char answer of quotes is 2000 chars in JSON, so eight of them go over 10k.
    const quotes = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`t${i}`, "\"".repeat(1000)]));
    const big = {
      ...config,
      fields: [
        ...config.fields.slice(0, 7),
        ...Array.from({ length: 8 }, (_, i) => ({ key: `t${i}`, label: `T${i}`, type: "textarea", required: false })),
      ],
    } as LeadFormConfig;
    expectFail(mapLeadFormSubmission(big, { ...valid, ...quotes }));
  });

  it("with no formFields, a page whose required fields are empty fails", () => {
    expectFail(mapLeadFormSubmission(config, undefined));
  });
});
