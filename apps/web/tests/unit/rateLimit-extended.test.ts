import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const redisState = vi.hoisted(() => ({
    client: null as null | {
        isOpen: boolean;
        get: ReturnType<typeof vi.fn>;
        set: ReturnType<typeof vi.fn>;
        del: ReturnType<typeof vi.fn>;
    },
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

    it("builds stable identifiers from user id, api key, forwarded IP, real IP, and unknown clients", async () => {
        const { getClientIdentifier } = await loadRateLimit();

        expect(getClientIdentifier(request(), "user-1")).toBe("user:user-1");
        expect(getClientIdentifier(request({ "x-api-key": "key-1" }))).toBe("apikey:key-1");
        expect(getClientIdentifier(request({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }))).toBe("ip:203.0.113.1");
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

    it("uses Redis when available and respects stored windows", async () => {
        let stored: string | null = JSON.stringify({ count: 1, resetTime: 2000 });
        vi.spyOn(Date, "now").mockReturnValue(1000);
        redisState.client = {
            isOpen: true,
            get: vi.fn(async () => stored),
            set: vi.fn(async (_key, value) => {
                stored = value;
            }),
            del: vi.fn(),
        };
        const { checkRateLimit } = await loadRateLimit();

        const allowed = await checkRateLimit("user", { maxRequests: 2, windowMs: 1000 }, "endpoint");
        const blocked = await checkRateLimit("user", { maxRequests: 2, windowMs: 1000 }, "endpoint");

        expect(allowed).toEqual({ allowed: true, remaining: 0, resetTime: 2000 });
        expect(blocked).toEqual({ allowed: false, remaining: 0, resetTime: 2000 });
        expect(redisState.client.set).toHaveBeenCalledWith(
            "ratelimit:endpoint:user",
            JSON.stringify({ count: 2, resetTime: 2000 }),
            { EX: 1 }
        );
    });

    it("falls back to LRU when Redis throws", async () => {
        redisState.client = {
            isOpen: true,
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

    it("reads status from Redis before falling back to memory and resets both stores", async () => {
        redisState.safeGet.mockResolvedValueOnce(JSON.stringify({ count: 7, resetTime: 9000 })).mockResolvedValueOnce(null);
        const { checkRateLimit, getRateLimitStatus, resetRateLimit } = await loadRateLimit();

        await expect(getRateLimitStatus("user", "endpoint")).resolves.toEqual({ count: 7, resetTime: 9000 });

        await checkRateLimit("user", { maxRequests: 3, windowMs: 1000 }, "endpoint");
        await expect(getRateLimitStatus("user", "endpoint")).resolves.toMatchObject({ count: 1 });

        await resetRateLimit("user", "endpoint");
        expect(redisState.safeDel).toHaveBeenCalledWith("ratelimit:endpoint:user");
        await expect(getRateLimitStatus("user", "endpoint")).resolves.toBeNull();
    });
});
