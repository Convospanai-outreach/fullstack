import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));

vi.mock("@/lib/redis", () => ({
    getRedisClient: vi.fn(async () => null),
    safeGet: vi.fn(),
    safeDel: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: mockWarn, error: vi.fn() } }));

const config = { windowMs: 60_000, maxRequests: 1 };

function request(ip: string) {
    return new Request("https://app.example.com/api/thing", { headers: { "cf-connecting-ip": ip } }) as any;
}

async function load() {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    return import("@/lib/rateLimit");
}

describe("applyRateLimit - denial logging", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
    });

    it("logs a denial with the endpoint, who is limited by kind, and the limit - not the address", async () => {
        const { applyRateLimit } = await load();

        await applyRateLimit(request("203.0.113.5"), config, "auth");
        const denied = await applyRateLimit(request("203.0.113.5"), config, "auth");

        expect(denied?.status).toBe(429);
        expect(mockWarn).toHaveBeenCalledTimes(1);
        expect(mockWarn).toHaveBeenCalledWith("ratelimit.exceeded", {
            endpoint: "auth",
            identifierType: "ip",
            limit: 1,
            windowMs: 60_000,
        });
        expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("203.0.113.5");
    });

    it("reports a signed-in caller as a user", async () => {
        const { applyRateLimit } = await load();

        await applyRateLimit(request("203.0.113.6"), config, "ai", "user-9");
        await applyRateLimit(request("203.0.113.6"), config, "ai", "user-9");

        expect(mockWarn.mock.calls[0]![1]).toMatchObject({ identifierType: "user" });
        expect(JSON.stringify(mockWarn.mock.calls)).not.toContain("user-9");
    });

    it("logs once per window, so a flood of denied requests is not a flood of log lines", async () => {
        const { applyRateLimit } = await load();

        await applyRateLimit(request("203.0.113.7"), config, "auth");
        for (let i = 0; i < 20; i++) await applyRateLimit(request("203.0.113.7"), config, "auth");

        expect(mockWarn).toHaveBeenCalledTimes(1);
    });

    it("logs again for another endpoint and does not log allowed requests", async () => {
        const { applyRateLimit } = await load();

        await applyRateLimit(request("203.0.113.8"), config, "auth");
        expect(mockWarn).not.toHaveBeenCalled();

        await applyRateLimit(request("203.0.113.8"), config, "auth");
        await applyRateLimit(request("203.0.113.8"), config, "register");
        await applyRateLimit(request("203.0.113.8"), config, "register");

        expect(mockWarn).toHaveBeenCalledTimes(2);
    });
});
