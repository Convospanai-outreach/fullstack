import { beforeEach, describe, expect, it, vi } from "vitest";
const { mockRandomBytes } = vi.hoisted(() => ({
  mockRandomBytes: vi.fn(),
}));

vi.mock("node:crypto", () => ({
  randomBytes: mockRandomBytes,
}));

import {
  API_KEY_SCOPE_ALLOWLIST,
  API_KEY_SECRET_BYTES,
  DEFAULT_API_KEY_SCOPES,
  NEW_API_KEY_PREFIX,
  ApiKeyValidationError,
  createApiKeySecret,
  getApiKeyDisplayMetadata,
  isValidLegacyApiKeyFormat,
  isValidNewApiKeyFormat,
  isValidPresentedApiKey,
  validateApiKeyScopes,
} from "./apiKeySecurity";

const newKey = (character = "a") => NEW_API_KEY_PREFIX + character.repeat(64);
const legacyKey = (prefix: "cs_live_" | "sk_live_") => prefix + "b".repeat(48);

describe("api key security primitives", () => {
  beforeEach(() => mockRandomBytes.mockReset());

  it("generates 32 random bytes in the new format with 256 bits of material", () => {
    mockRandomBytes.mockReturnValue(Buffer.alloc(API_KEY_SECRET_BYTES, 0xab));

    const generated = createApiKeySecret();

    expect(mockRandomBytes).toHaveBeenCalledOnce();
    expect(mockRandomBytes).toHaveBeenCalledWith(32);
    expect(generated.secret).toMatch(/^cmf_live_[a-f0-9]{64}$/);
    expect(generated.secret.slice(NEW_API_KEY_PREFIX.length)).toHaveLength(64);
    expect(generated).toEqual({
      secret: generated.secret,
      keyPrefix: NEW_API_KEY_PREFIX,
      keyLastFour: "abab",
    });
  });

  it("returns different keys for different random byte output", () => {
    mockRandomBytes
      .mockReturnValueOnce(Buffer.alloc(API_KEY_SECRET_BYTES, 0x01))
      .mockReturnValueOnce(Buffer.alloc(API_KEY_SECRET_BYTES, 0x02));

    expect(createApiKeySecret().secret).not.toBe(createApiKeySecret().secret);
  });

  it("accepts valid new keys and rejects malformed or unknown formats", () => {
    expect(isValidNewApiKeyFormat(newKey())).toBe(true);
    expect(isValidPresentedApiKey(newKey())).toBe(true);

    for (const value of [
      NEW_API_KEY_PREFIX + "a".repeat(63),
      NEW_API_KEY_PREFIX + "A".repeat(64),
      "cmf_test_" + "a".repeat(64),
      "not-an-api-key",
    ]) {
      expect(isValidNewApiKeyFormat(value)).toBe(false);
      expect(isValidPresentedApiKey(value)).toBe(false);
    }
  });

  it("classifies only the documented legacy formats", () => {
    for (const value of [legacyKey("cs_live_"), legacyKey("sk_live_")]) {
      expect(isValidLegacyApiKeyFormat(value)).toBe(true);
      expect(isValidPresentedApiKey(value)).toBe(true);
    }
    expect(isValidLegacyApiKeyFormat("sk_live_" + "B".repeat(48))).toBe(false);
  });

  it("returns display metadata only, never the complete secret", () => {
    const secret = newKey("c");
    const metadata = getApiKeyDisplayMetadata(secret);

    expect(metadata).toEqual({
      keyPrefix: NEW_API_KEY_PREFIX,
      keyLastFour: "cccc",
      legacy: false,
    });
    expect(Object.keys(metadata).sort()).toEqual([
      "keyLastFour",
      "keyPrefix",
      "legacy",
    ]);
    expect(JSON.stringify(metadata)).not.toContain(secret);
    expect(getApiKeyDisplayMetadata(legacyKey("sk_live_"))).toEqual({
      keyPrefix: "sk_live_",
      keyLastFour: "bbbb",
      legacy: true,
    });
  });

  it("uses least-privilege defaults and accepts valid allowlisted scopes", () => {
    expect(validateApiKeyScopes(undefined)).toEqual([...DEFAULT_API_KEY_SCOPES]);
    expect(validateApiKeyScopes(["leads:read", "tasks:write"])).toEqual(["leads:read", "tasks:write"]);
  });

  it("rejects unknown and duplicate scopes", () => {
    expect(() => validateApiKeyScopes(["unknown:scope"])).toThrow(
      ApiKeyValidationError
    );
    expect(() => validateApiKeyScopes(["leads:read", "leads:read"])).toThrow(
      ApiKeyValidationError
    );
  });

  it("rejects empty, oversized, and malformed scope input", () => {
    expect(() => validateApiKeyScopes([])).toThrow(ApiKeyValidationError);
    expect(() => validateApiKeyScopes(["leads:read", 1])).toThrow(
      ApiKeyValidationError
    );
    expect(() => validateApiKeyScopes(
      Array(API_KEY_SCOPE_ALLOWLIST.length + 1).fill("leads:read")
    )).toThrow(ApiKeyValidationError);
  });

  it("does not include raw key values in validation errors", () => {
    const secret = newKey("d");
    let thrown: Error | undefined;

    try {
      validateApiKeyScopes([secret]);
    } catch (error) {
      thrown = error as Error;
    }

    expect(thrown).toBeInstanceOf(ApiKeyValidationError);
    expect(thrown?.message).not.toContain(secret);
  });
});
