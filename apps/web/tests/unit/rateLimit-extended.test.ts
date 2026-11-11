import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const redisState = vi.hoisted(() => ({
    client: null as any,
    safeGet: vi.fn(),
    safeDel: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
    getRedisClient: vi.fn(async () => redisState.client),
    safeGet: redisState.safeGet,
    safeDel: redisState.safeDel,
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

async function loadRateLimit() {
    vi.resetModules();
    return import("@/lib/rateLimit");
}

// Implements RATE_LIMIT_SCRIPT's semantics in memory. Each eval runs to completion before the
// next, as a Lua script does inside Redis.
function fakeRedis() {
    const store = new Map<string, { value: number; expiresAt: number }>();
    const live = (key: string) => {
        const entry = store.get(key);
        if (entry && Date.now() >= entry.expiresAt) store.delete(key);
        return store.get(key);
    };
    return {
        status: "ready",
        eval: vi.fn(async (_script: string, _keys: number, key: string, windowMs: string) => {
            const entry = live(key);
            const next = { value: (entry?.value ?? 0) + 1, expiresAt: entry?.expiresAt ?? Date.now() + Number(windowMs) };
            store.set(key, next);
            return [next.value, next.expiresAt - Date.now()];
        }),
        get: vi.fn(async (key: string) => (live(key) ? String(live(key)!.value) : null)),
        pttl: vi.fn(async (key: string) => (live(key) ? live(key)!.expiresAt - Date.now() : -2)),
        set: vi.fn(),
        del: vi.fn(),
    };
}

function request(headers: Record<string, string> = {}) {
    return new Request("https://example.test/api", { headers }) as unknown as NextRequest;
}

describe("rateLimit extended behavior", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        redisState.client = null;
        redisState.safeGet.mockResolvedValue(null);
        redisState.safeDel.mockResolvedValue(true);
        process.env = { ...originalEnv, NODE_ENV: "test" };
    });

    it("builds stable identifiers from user id, Cloudflare IP, forwarded IP, real IP, and unknown clients", async () => {
        const { getClientIdentifier } = await loadRateLimit();

        expect(getClientIdentifier(request(), "user-1")).toBe("user:user-1");
        // A caller-chosen value must not pick the bucket: an unchecked x-api-key and the leftmost
        // (client-written) X-Forwarded-For entry are ignored.
        expect(getClientIdentifier(request({ "x-api-key": "key-1", "cf-connecting-ip": "203.0.113.8" }))).toBe("ip:203.0.113.8");
        expect(getClientIdentifier(request({ "cf-connecting-ip": "203.0.113.8", "x-forwarded-for": "198.18.0.1" }))).toBe("ip:203.0.113.8");
        expect(getClientIdentifier(request({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("ip:10.0.0.1");
        expect(getClientIdentifier(request({ "x-real-ip": "198.51.100.2" }))).toBe("ip:198.51.100.2");
        expect(getClientIdentifier(request())).toBe("ip:unknown");
    });

    it("short-circuits when rate limiting is disabled", async () => {
        process.env["DISABLE_RATE_LIMIT"] = "true";
        const { checkRateLimit } = await loadRateLimit();

        const result = await checkRateLimit("id", { maxRequests: 1, windowMs: 1000 }, "login");

        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(1);
    });

    it("counts in Redis with one atomic script call and refuses past the limit", async () => {
        vi.spyOn(Date, "now").mockReturnValue(1000);
        const redis = fakeRedis();
        redisState.client = redis;
        const { checkRateLimit } = await loadRateLimit();

        const results = [];
        for (let i = 0; i < 3; i++) results.push(await checkRateLimit("user", { maxRequests: 2, windowMs: 1000 }, "endpoint"));

        expect(results).toEqual([
            { allowed: true, remaining: 1, resetTime: 2000 },
            { allowed: true, remaining: 0, resetTime: 2000 },
            { allowed: false, remaining: 0, resetTime: 2000 },
        ]);
        expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("INCR"), 1, "ratelimit:v2:endpoint:user", "1000");
        // The old get-then-set is gone: that read-modify-write was the race.
        expect(redis.get).not.toHaveBeenCalled();
        expect(redis.set).not.toHaveBeenCalled();
    });

    it("lets no more than the limit through a concurrent burst", async () => {
        redisState.client = fakeRedis();
        const { checkRateLimit } = await loadRateLimit();

        const burst = await Promise.all(
            Array.from({ length: 20 }, () => checkRateLimit("burst", { maxRequests: 5, windowMs: 60_000 }, "auth"))
        );

        expect(burst.filter((r) => r.allowed)).toHaveLength(5);
    });

    it("reads status from the Redis counter and resets the v2 key", async () => {
        vi.spyOn(Date, "now").mockReturnValue(1000);
        redisState.client = fakeRedis();
        const { checkRateLimit, getRateLimitStatus, resetRateLimit } = await loadRateLimit();

        await checkRateLimit("user", { maxRequests: 3, windowMs: 1000 }, "endpoint");
        await checkRateLimit("user", { maxRequests: 3, windowMs: 1000 }, "endpoint");
        await expect(getRateLimitStatus("user", "endpoint")).resolves.toEqual({ count: 2, resetTime: 2000 });

        await resetRateLimit("user", "endpoint");
        expect(redisState.safeDel).toHaveBeenCalledWith("ratelimit:v2:endpoint:user");
    });

    it("falls back to LRU when Redis throws", async () => {
        redisState.client = {
            status: "ready",
            eval: vi.fn(async () => {
                throw new Error("redis unavailable");
            }),
            get: vi.fn(async () => {
                throw new Error("redis unavailable");
            }),
            set: vi.fn(),
            del: vi.fn(),
        };
        const { checkRateLimit } = await loadRateLimit();

        const first = await checkRateLimit("fallback", { maxRequests: 1, windowMs: 1000 }, "endpoint");
        const second = await checkRateLimit("fallback", { maxRequests: 1, windowMs: 1000 }, "endpoint");

        expect(first.allowed).toBe(true);
        expect(second.allowed).toBe(false);
    });

    it("returns production 429 responses and attaches rate limit headers", async () => {
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
        const { applyRateLimit, addRateLimitHeaders } = await loadRateLimit();

        const first = await applyRateLimit(request({ "x-real-ip": "192.0.2.10" }), { maxRequests: 1, windowMs: 60_000 }, "auth");
        const second = await applyRateLimit(request({ "x-real-ip": "192.0.2.10" }), { maxRequests: 1, windowMs: 60_000 }, "auth");

        expect(first).toBeNull();
        expect(second?.status).toBe(429);
        expect(second?.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(second?.headers.get("Retry-After")).toBeTruthy();

        const response = addRateLimitHeaders(NextResponse.json({ ok: true }), { maxRequests: 5, windowMs: 1000 }, 3, 123);
        expect(response.headers.get("X-RateLimit-Limit")).toBe("5");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("3");
        expect(response.headers.get("X-RateLimit-Reset")).toBe("123");
    });

    it("clears in-memory cache and returns stats", async () => {
        const { clearAllRateLimits, getRateLimitStats, applyRateLimit } = await loadRateLimit();
        await clearAllRateLimits();
        const stats = getRateLimitStats();
        expect(stats.size).toBe(0);
        expect(stats.maxSize).toBe(10000);

        // Test applyRateLimit in prod mode
        const originalEnv = process.env["NODE_ENV"];
        (process.env as Record<string, string | undefined>)["NODE_ENV"] = "production";
        delete (process.env as Record<string, string | undefined>)["DISABLE_RATE_LIMIT"];
        try {
          const req = new Request("http://localhost:3000/api/test") as unknown as NextRequest;
          const res = await applyRateLimit(req, { maxRequests: 10, windowMs: 1000 }, "test");
          expect(res).toBeNull();
        } finally {
          (process.env as Record<string, string | undefined>)["NODE_ENV"] = originalEnv;
        }
    });
});
