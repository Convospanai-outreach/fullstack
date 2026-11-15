import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  decodeLeadFormMarkerId,
  encodeLeadFormMarkerId,
  isSafeRedirectUrl,
  LEAD_FORM_MARKER_ID_PREFIX,
  LEAD_FORM_MAX_MARKER_ID_LENGTH,
  parseLeadFormConfig,
  type LeadFormConfig,
} from "./leadFormConfig";

// Same fixture as the API copy of this module (apps/api/.../leadFormConfig.test.ts reads it with fs).
const fixture = JSON.parse(
  readFileSync(resolve(__dirname, "../../../tests/fixtures/lead-form-config.json"), "utf8")
) as { valid: Record<string, unknown>; invalid: Record<string, unknown> };

describe("lead form config validation (shared fixture)", () => {
  it.each(Object.keys(fixture.valid))("accepts %s", (name) => {
    expect(parseLeadFormConfig(fixture.valid[name])).not.toBeNull();
  });

  it.each(Object.keys(fixture.invalid))("rejects %s", (name) => {
    expect(parseLeadFormConfig(fixture.invalid[name])).toBeNull();
  });

  it("rejects non-object input", () => {
    expect(parseLeadFormConfig(null)).toBeNull();
    expect(parseLeadFormConfig("fields")).toBeNull();
  });
});

describe("redirect URL rule", () => {
  it("allows only https", () => {
    expect(isSafeRedirectUrl("https://example.com/thanks")).toBe(true);
    expect(isSafeRedirectUrl("http://example.com")).toBe(false);
    expect(isSafeRedirectUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeRedirectUrl("data:text/html,hi")).toBe(false);
    expect(isSafeRedirectUrl("https://")).toBe(false);
  });
});

describe("marker id encoding", () => {
  const valid = fixture.valid["full"] as LeadFormConfig;

  it("uses the cmf-form- prefix and base64url charset only", () => {
    const id = encodeLeadFormMarkerId(valid);
    expect(id.startsWith(LEAD_FORM_MARKER_ID_PREFIX)).toBe(true);
    expect(id).toMatch(/^cmf-form-[A-Za-z0-9_-]+$/);
  });

  it.each(Object.keys(fixture.valid))("round-trips %s", (name) => {
    const config = parseLeadFormConfig(fixture.valid[name]) as LeadFormConfig;
    expect(decodeLeadFormMarkerId(encodeLeadFormMarkerId(config))).toEqual(config);
  });

  it("refuses to encode an invalid config", () => {
    expect(() => encodeLeadFormMarkerId(fixture.invalid["nine-fields"] as LeadFormConfig)).toThrow();
  });

  it("refuses to encode a config whose id would exceed the length cap", () => {
    // Labels are at most 80 chars, so 8 long fields plus an email field can still be too long once encoded.
    const long = "é".repeat(80);
    const fields = [
      { key: "email", label: long, type: "email", required: true },
      ...Array.from({ length: 7 }, (_, i) => ({ key: `f${i}`, label: long, type: "text", required: false })),
    ];
    const config = { fields, buttonLabel: "Send", successMessage: "x".repeat(300) } as unknown as LeadFormConfig;
    expect(parseLeadFormConfig(config)).not.toBeNull();
    expect(() => encodeLeadFormMarkerId(config)).toThrow();
    expect(LEAD_FORM_MAX_MARKER_ID_LENGTH).toBe(2000);
  });

  it.each([
    ["wrong prefix", "cmf-x-" + encodeLeadFormMarkerId(valid).slice(LEAD_FORM_MARKER_ID_PREFIX.length)],
    ["characters outside base64url", "cmf-form-abc$def"],
    ["too long", "cmf-form-" + "A".repeat(LEAD_FORM_MAX_MARKER_ID_LENGTH)],
    ["not base64 of JSON", "cmf-form-bm90IGpzb24"],
    ["base64 of an invalid config", "cmf-form-" + Buffer.from(JSON.stringify(fixture.invalid["nine-fields"])).toString("base64url")],
    ["empty payload", "cmf-form-"],
  ])("decodes to null for %s", (_name, id) => {
    expect(decodeLeadFormMarkerId(id)).toBeNull();
  });
});
