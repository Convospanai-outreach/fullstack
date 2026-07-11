import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    apiKey: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import {
  authorizeApiKey,
  resetApiKeyAuthRateLimitForTests,
  validateApiKey,
} from "./apiAuth";
import {
  NEW_API_KEY_PREFIX,
  createStoredApiKeyValue,
} from "./apiKeySecurity";

const newKey = (character = "a") => NEW_API_KEY_PREFIX + character.repeat(64);
const legacyKey = (prefix: "cs_live_" | "sk_live_") => prefix + "b".repeat(48);

function request(key?: string, source = "203.0.113.7") {
  const headers: Record<string, string> = { "x-forwarded-for": source };
  if (key) headers["x-api-key"] = key;
  return new Request("http://localhost/api/v1/leads", { headers }) as any;
}

describe("api key auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiKeyAuthRateLimitForTests();
    mockPrisma.apiKey.update.mockResolvedValue({});
  });

  it("looks up new keys by stored digest and never by raw token", async () => {
    const raw = newKey("a");
    const stored = createStoredApiKeyValue(raw);
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: "key-1",
      teamId: "team-1",
      scopes: ["leads:read"],
      isActive: true,
    });

    const auth = await validateApiKey(request(raw), "leads:read");

    expect(auth).toEqual({
      keyId: "key-1",
      teamId: "team-1",
      scopes: ["leads:read"],
    });
    expect(mockPrisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: { key: { in: [stored] } },
    });
    expect(JSON.stringify(mockPrisma.apiKey.findFirst.mock.calls)).not.toContain(raw);
    expect(mockPrisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: "key-1" },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it("keeps legacy raw-key lookup explicit during the transition", async () => {
    const raw = legacyKey("sk_live_");
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: "key-legacy",
      teamId: "team-legacy",
      scopes: ["leads:read"],
      isActive: true,
    });

    const auth = await validateApiKey(request(raw), "leads:read");

    expect(auth?.teamId).toBe("team-legacy");
    expect(mockPrisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: { key: { in: [raw] } },
    });
  });

  it("does not treat legacy admin scope as an implicit bypass", async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: "key-admin",
      teamId: "team-1",
      scopes: ["admin"],
      isActive: true,
    });

    await expect(validateApiKey(request(legacyKey("cs_live_")), "leads:read")).resolves.toBeNull();
  });

  it("throttles failed attempts by source and endpoint, not candidate key", async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue(null);
    let result = await authorizeApiKey(request("not-a-real-key-0"), "leads:read");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);

    for (let i = 1; i <= 10; i += 1) {
      result = await authorizeApiKey(request(`not-a-real-key-${i}`), "leads:read");
    }

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBeTruthy();
    }
  });

  it("does not block a valid key only because the source has failed attempts", async () => {
    for (let i = 0; i <= 10; i += 1) {
      await authorizeApiKey(request(`bad-key-${i}`), "leads:read");
    }

    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: "key-1",
      teamId: "team-1",
      scopes: ["leads:read"],
      isActive: true,
    });

    const result = await authorizeApiKey(request(newKey("f")), "leads:read");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.teamId).toBe("team-1");
  });
});
