import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { mockCheckRateLimit, mockLogger, mockPrisma } = vi.hoisted(() => ({
  mockCheckRateLimit: vi.fn(),
  mockLogger: { warn: vi.fn() },
  mockPrisma: {
    apiKey: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/rateLimit", () => ({
  checkRateLimit: mockCheckRateLimit,
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

import { validateApiKey } from "./apiAuth";
import {
  LEGACY_API_KEY_RETIREMENT_DATE,
  createApiKeySecret,
} from "./apiKeySecurity";

function request(apiKey: string): NextRequest {
  return new Request("http://localhost/api/v1/leads", {
    headers: { "x-api-key": apiKey },
  }) as NextRequest;
}

function record(key: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "key-1",
    key,
    teamId: "team-b",
    scopes: ["leads:read"],
    isActive: true,
    ...overrides,
  };
}

describe("API key authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 59,
      resetTime: Date.now() + 60_000,
    });
    mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("authenticates a valid hashed key and derives the team only from the stored record", async () => {
    const generated = createApiKeySecret();
    mockPrisma.apiKey.findUnique.mockResolvedValue(record(generated.lookup));

    await expect(validateApiKey(request(generated.secret), "leads:read"))
      .resolves.toEqual({
        teamId: "team-b",
        scopes: ["leads:read"],
        keyId: "key-1",
      });
    expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledWith({
      where: { key: generated.lookup },
    });
  });

  it("fails wrong and malformed keys without exposing lookup behavior", async () => {
    const generated = createApiKeySecret();
    mockPrisma.apiKey.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    await expect(validateApiKey(request(generated.secret), "leads:read")).resolves.toBeNull();
    await expect(validateApiKey(request("not-an-api-key"), "leads:read")).resolves.toBeNull();
    expect(mockPrisma.apiKey.findUnique).toHaveBeenCalledTimes(2);
  });

  it("rejects revoked keys and insufficient scopes", async () => {
    const generated = createApiKeySecret();
    mockPrisma.apiKey.findUnique.mockResolvedValueOnce(
      record(generated.lookup, { isActive: false })
    );
    await expect(validateApiKey(request(generated.secret), "leads:read")).resolves.toBeNull();

    mockPrisma.apiKey.findUnique.mockResolvedValueOnce(
      record(generated.lookup, { scopes: ["leads:read"] })
    );
    await expect(validateApiKey(request(generated.secret), "leads:write")).resolves.toBeNull();
  });

  it("fails closed when the authentication rate limit is exhausted", async () => {
    const generated = createApiKeySecret();
    mockCheckRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
    });

    await expect(validateApiKey(request(generated.secret), "leads:read")).resolves.toBeNull();
    expect(mockPrisma.apiKey.findUnique).not.toHaveBeenCalled();
  });

  it("upgrades an accepted legacy raw key to a safe lookup record on use", async () => {
    const legacy = "sk_live_" + "a".repeat(48);
    mockPrisma.apiKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(record(legacy, { scopes: ["admin"] }));

    await expect(validateApiKey(request(legacy), "leads:write"))
      .resolves.toMatchObject({ teamId: "team-b", keyId: "key-1" });

    const upgradeCall = mockPrisma.apiKey.updateMany.mock.calls[0][0];
    expect(upgradeCall.where).toEqual({
      id: "key-1",
      key: legacy,
      isActive: true,
    });
    expect(upgradeCall.data.key).toMatch(/^v2:[a-f0-9]{64}:[a-f0-9]{4}$/);
    expect(upgradeCall.data.key.includes(legacy)).toBe(false);
  });

  it("rejects legacy keys after the documented retirement date", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(LEGACY_API_KEY_RETIREMENT_DATE);
    const legacy = "cs_live_" + "b".repeat(48);
    mockPrisma.apiKey.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(record(legacy));

    await expect(validateApiKey(request(legacy), "leads:read")).resolves.toBeNull();
    expect(mockPrisma.apiKey.updateMany).not.toHaveBeenCalled();
  });

  it("never logs a raw key when usage metadata persistence fails", async () => {
    const generated = createApiKeySecret();
    mockPrisma.apiKey.findUnique.mockResolvedValue(record(generated.lookup));
    mockPrisma.apiKey.updateMany.mockRejectedValueOnce(new Error("write failed"));

    await validateApiKey(request(generated.secret), "leads:read");
    await Promise.resolve();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "[ApiKeyAuth] Unable to update key usage metadata",
      { apiKeyId: "key-1" }
    );
    expect(JSON.stringify(mockLogger.warn.mock.calls)).not.toContain(generated.secret);
  });
});
