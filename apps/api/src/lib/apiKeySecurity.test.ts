import { describe, expect, it } from "vitest";
import {
  API_KEY_LIST_MAX_LIMIT,
  DEFAULT_API_KEY_SCOPES,
  LEGACY_API_KEY_RETIREMENT_DATE,
  ApiKeyValidationError,
  createApiKeyLookup,
  createApiKeySecret,
  getApiKeyAuthRateLimitIdentifier,
  getApiKeyDisplayMetadata,
  hasRequiredApiKeyScope,
  isValidPresentedApiKey,
  parseApiKeyCreationInput,
  parseApiKeyListPagination,
} from "./apiKeySecurity";

describe("api key security primitives", () => {
  it("generates a one-time high-entropy secret while storing only a lookup record", () => {
    const generated = createApiKeySecret();

    expect(generated.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
    expect(generated.lookup).toMatch(/^v2:[a-f0-9]{64}:[a-f0-9]{4}$/);
    expect(generated.lookup.includes(generated.secret)).toBe(false);
    expect(generated.keyLastFour).toHaveLength(4);
  });

  it("derives metadata without returning a raw secret or lookup hash", () => {
    const generated = createApiKeySecret();
    const metadata = getApiKeyDisplayMetadata(generated.lookup);

    expect(metadata).toEqual({
      keyPrefix: "cmf_live_",
      keyLastFour: generated.keyLastFour,
      legacy: false,
    });
    expect(Object.values(metadata).join("|").includes(generated.lookup)).toBe(false);
  });

  it("uses a least-privilege default scope and rejects unknown or duplicate scopes", () => {
    expect(parseApiKeyCreationInput({ name: "CRM" }).scopes).toEqual(DEFAULT_API_KEY_SCOPES);

    expect(() => parseApiKeyCreationInput({
      name: "CRM",
      scopes: ["leads:read", "leads:read"],
    })).toThrow(ApiKeyValidationError);
    expect(() => parseApiKeyCreationInput({
      name: "CRM",
      scopes: ["admin"],
    })).toThrow(ApiKeyValidationError);
    expect(() => parseApiKeyCreationInput({
      name: "CRM",
      scopes: ["unknown:scope"],
    })).toThrow(ApiKeyValidationError);
  });

  it("rejects malformed creation requests and bounds key-list pagination", () => {
    expect(() => parseApiKeyCreationInput({ name: "" })).toThrow(ApiKeyValidationError);
    expect(() => parseApiKeyCreationInput({
      name: "CRM",
      scopes: ["leads:read"],
      teamId: "attacker-controlled",
    })).toThrow(ApiKeyValidationError);

    expect(parseApiKeyListPagination(
      new URL("https://example.test/settings/keys?limit=999&offset=3")
    )).toEqual({ limit: API_KEY_LIST_MAX_LIMIT, offset: 3 });
    expect(() => parseApiKeyListPagination(
      new URL("https://example.test/settings/keys?limit=-1")
    )).toThrow(ApiKeyValidationError);
  });

  it("accepts only supported key formats and produces a stable safe lookup", () => {
    const generated = createApiKeySecret();
    const legacy = "sk_live_" + "a".repeat(48);

    expect(isValidPresentedApiKey(generated.secret)).toBe(true);
    expect(isValidPresentedApiKey(legacy)).toBe(true);
    expect(isValidPresentedApiKey("not-an-api-key")).toBe(false);
    expect(createApiKeyLookup(generated.secret)).toBe(generated.lookup);
    expect(getApiKeyAuthRateLimitIdentifier(generated.secret)).not.toContain(generated.secret);
  });

  it("enforces exact scopes while preserving documented legacy admin compatibility only before retirement", () => {
    expect(hasRequiredApiKeyScope(["leads:read"], "leads:read", false)).toBe(true);
    expect(hasRequiredApiKeyScope(["leads:read"], "leads:write", false)).toBe(false);
    expect(hasRequiredApiKeyScope(["admin"], "leads:write", false)).toBe(false);
    expect(hasRequiredApiKeyScope(
      ["admin"],
      "leads:write",
      true,
      new Date(LEGACY_API_KEY_RETIREMENT_DATE.getTime() - 1)
    )).toBe(true);
    expect(hasRequiredApiKeyScope(
      ["admin"],
      "leads:write",
      true,
      LEGACY_API_KEY_RETIREMENT_DATE
    )).toBe(false);
  });
});
