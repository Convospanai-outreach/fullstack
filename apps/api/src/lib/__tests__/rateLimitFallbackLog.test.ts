import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logger = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@/lib/redis", () => ({
    getRedisClient: vi.fn(async () => null),
    safeGet: vi.fn(),
    safeDel: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger }));

async function check() {
    vi.resetModules();
    const { checkRateLimit } = await import("@/lib/rateLimit");
    return checkRateLimit("user", { maxRequests: 5, windowMs: 1000 }, "endpoint");
}

describe("in-memory rate limit fallback log", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env["DISABLE_RATE_LIMIT"];
        delete process.env["DISABLE_REDIS"];
    });
    afterEach(() => vi.unstubAllEnvs());

    it("logs an error in production when Redis is unavailable", async () => {
        vi.stubEnv("NODE_ENV", "production");
        await check();
        expect(logger.error).toHaveBeenCalledWith("rate_limit_fallback_inmemory", expect.any(Object));
    });

    it("stays quiet in production when Redis is disabled on purpose", async () => {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("DISABLE_REDIS", "true");
        const result = await check();
        expect(result.allowed).toBe(true);
        expect(logger.error).not.toHaveBeenCalled();
    });
});
