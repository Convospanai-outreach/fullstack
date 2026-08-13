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
  API_KEY_REQUEST_SOURCE_HEADER,
  authorizeApiKey,
  getApiKeyRoutePolicy,
  resetApiKeyAuthRateLimitForTests,
  validateApiKey,
} from "./apiAuth";
import {
  NEW_API_KEY_PREFIX,
  createStoredApiKeyValue,
} from "./apiKeySecurity";

const newKey = (character = "a") => NEW_API_KEY_PREFIX + character.repeat(64);
const legacyKey = (prefix: "cs_live_" | "sk_live_") => prefix + "b".repeat(48);

function request(key?: string, source = "server-source-1", path = "/api/v1/leads") {
  const headers: Record<string, string> = {
    [API_KEY_REQUEST_SOURCE_HEADER]: source,
    "x-forwarded-for": "198.51.100.99",
  };
  if (key) headers["x-api-key"] = key;
  return new Request(`http://localhost${path}`, { headers }) as any;
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

  it("throttles failed attempts by server source and route family", async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue(null);
    let result = await authorizeApiKey(request(newKey("c")), "leads:read");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);

    for (let i = 1; i <= 10; i += 1) {
      result = await authorizeApiKey(request(newKey(String(i % 10))), "leads:read");
    }

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(429);
      expect(result.response.headers.get("Retry-After")).toBeTruthy();
    }
    // 1 initial call + 10 loop iterations: every well-formed candidate key now reaches the
    // DB lookup, even once the bucket is tripped, so a valid key is never falsely blocked.
    expect(mockPrisma.apiKey.findFirst).toHaveBeenCalledTimes(11);
  });

  it("never blocks a request presenting a genuinely valid key, even with the bucket tripped", async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue(null);
    for (let i = 1; i <= 10; i += 1) {
      await authorizeApiKey(request(newKey(String(i % 10)), "server-source-3"), "leads:read");
    }
    const tripped = await authorizeApiKey(request(newKey("e"), "server-source-3"), "leads:read");
    expect(tripped.ok).toBe(false);
    if (!tripped.ok) expect(tripped.response.status).toBe(429);

    mockPrisma.apiKey.findFirst.mockResolvedValue({
      id: "key-valid",
      teamId: "team-valid",
      scopes: ["leads:read"],
      isActive: true,
    });
    const result = await authorizeApiKey(request(newKey("d"), "server-source-3"), "leads:read");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.context.teamId).toBe("team-valid");
  });

  it("does not let spoofed client source headers or dynamic ids bypass failed-auth throttles", async () => {
    mockPrisma.apiKey.findFirst.mockResolvedValue(null);
    for (let i = 0; i <= 10; i += 1) {
      await authorizeApiKey(request(newKey(String(i % 10)), "server-source-2", `/api/v1/leads/${i}`), "leads:read");
    }

    const spoofed = new Request("http://localhost/api/v1/leads/another", {
      headers: {
        [API_KEY_REQUEST_SOURCE_HEADER]: "server-source-2",
        "x-forwarded-for": "203.0.113.200",
        "x-api-key": newKey("f"),
      },
    }) as any;
    const result = await authorizeApiKey(spoofed, "leads:read");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(429);
  });

  it("does not record successful API-key traffic as failed-auth attempts", async () => {
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

  it("intentionally denies team API-key exposure for global agents routes", () => {
    expect(getApiKeyRoutePolicy("GET", "/v1/agents")).toBeNull();
    expect(getApiKeyRoutePolicy("POST", "/v1/agents")).toBeNull();
  });

  it("keeps tenant-owned knowledge routes explicitly registered for API-key clients", () => {
    expect(getApiKeyRoutePolicy("GET", "/v1/knowledge")).toMatchObject({
      authMode: "apiKey",
      requiredScope: "leads:read",
      throttleFamily: "v1.knowledge",
    });
    expect(getApiKeyRoutePolicy("POST", "/v1/knowledge")).toMatchObject({
      authMode: "apiKey",
      requiredScope: "leads:write",
      throttleFamily: "v1.knowledge",
    });
  });
});
