import { beforeEach, describe, expect, it, vi } from "vitest";

const redisState = vi.hoisted(() => ({ client: null as any, safeGet: vi.fn(), safeDel: vi.fn() }));

vi.mock("@/lib/redis", () => ({
    getRedisClient: vi.fn(async () => redisState.client),
    safeGet: redisState.safeGet,
    safeDel: redisState.safeDel,
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

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

// Same cases as apps/web/tests/unit/rateLimit-extended.test.ts: both limiters share the script.
describe("apps/api rate limiter on Redis", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        redisState.client = null;
        redisState.safeDel.mockResolvedValue(true);
        delete process.env["DISABLE_RATE_LIMIT"];
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
});
