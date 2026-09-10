import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RedisMock = vi.hoisted(() => vi.fn());

vi.mock("ioredis", () => ({
    Redis: RedisMock,
}));

async function loadRedisModule(env: Record<string, string | undefined> = {}) {
    vi.resetModules();
    vi.clearAllMocks();

    const mutableEnv = process.env as Record<string, string | undefined>;
    mutableEnv["REDIS_URL"] = env["REDIS_URL"];
    mutableEnv["DISABLE_REDIS"] = env["DISABLE_REDIS"];
    mutableEnv["CI"] = env["CI"];
    mutableEnv["GITHUB_ACTIONS"] = env["GITHUB_ACTIONS"];
    mutableEnv["NODE_ENV"] = env["NODE_ENV"] || "test";
    mutableEnv["NEXT_RUNTIME"] = env["NEXT_RUNTIME"] || "nodejs";

    return import("@/lib/redis");
}

function makeClient(overrides: Partial<{
    status: string;
    connect: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
}> = {}) {
    const client: any = {
        status: "wait",
        connect: vi.fn(async function connect(this: any) {
            this.status = "ready";
        }),
        quit: vi.fn(async function quit(this: any) {
            this.status = "end";
        }),
        disconnect: vi.fn(function disconnect(this: any) {
            this.status = "end";
        }),
        get: vi.fn(async () => "value"),
        set: vi.fn(async () => "OK"),
        del: vi.fn(async () => 1),
        on: vi.fn(),
        ...overrides,
    };
    return client;
}

describe("redis helpers", () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        process.env = { ...originalEnv };
    });

    it("returns null outside the node runtime", async () => {
        const redis = await loadRedisModule({ NEXT_RUNTIME: "edge" });

        await expect(redis.getRedisClient()).resolves.toBeNull();
        expect(RedisMock).not.toHaveBeenCalled();
    });

    it("does not create a client when redis is disabled or unavailable in CI", async () => {
        const disabled = await loadRedisModule({ DISABLE_REDIS: "true" });
        await expect(disabled.getRedisClient()).resolves.toBeNull();

        const ci = await loadRedisModule({ CI: "true" });
        await expect(ci.getRedisClient()).resolves.toBeNull();
    });

    it("connects, reuses, and closes an explicit redis client", async () => {
        const client = makeClient();
        RedisMock.mockImplementation(function (this: any) {
            return client;
        });
        const redis = await loadRedisModule({ REDIS_URL: "redis://localhost:6379" });

        await expect(redis.getRedisClient()).resolves.toBe(client);
        await expect(redis.getRedisClient()).resolves.toBe(client);
        expect(RedisMock).toHaveBeenCalledTimes(1);
        expect(RedisMock).toHaveBeenCalledWith("redis://127.0.0.1:6379", expect.any(Object));

        await redis.closeRedis();
        expect(client.quit).toHaveBeenCalled();
    });

    it("destroys failed clients and lets safe helpers degrade gracefully", async () => {
        const client = makeClient({
            connect: vi.fn(async () => {
                throw new Error("boom");
            }),
        });
        RedisMock.mockImplementation(function (this: any) {
            return client;
        });
        const redis = await loadRedisModule({ REDIS_URL: "redis://127.0.0.1:6379" });

        await expect(redis.getRedisClient()).resolves.toBeNull();
        expect(client.disconnect).toHaveBeenCalled();
        await expect(redis.safeGet("missing")).resolves.toBeNull();
        await expect(redis.safeSet("key", "value")).resolves.toBe(false);
        await expect(redis.safeDel("key")).resolves.toBe(false);
    });

    it("runs safe get/set/del against an open client", async () => {
        const client = makeClient({ status: "ready" });
        RedisMock.mockImplementation(function (this: any) {
            return client;
        });
        const redis = await loadRedisModule({ REDIS_URL: "redis://cache:6379" });

        await expect(redis.safeGet("key")).resolves.toBe("value");
        await expect(redis.safeSet("key", "value", 30)).resolves.toBe(true);
        await expect(redis.safeSet("key", "value")).resolves.toBe(true);
        await expect(redis.safeDel("key")).resolves.toBe(true);

        expect(client.set).toHaveBeenCalledWith("key", "value", "EX", 30);
        expect(client.set).toHaveBeenCalledWith("key", "value");
        expect(client.del).toHaveBeenCalledWith("key");
    });

    it("catches errors in safeSet and safeDel when operations throw", async () => {
        const client = makeClient({
            status: "ready",
            set: vi.fn(async () => { throw new Error("set error"); }),
            del: vi.fn(async () => { throw new Error("del error"); }),
        });
        RedisMock.mockImplementation(function (this: any) {
            return client;
        });
        const redis = await loadRedisModule({ REDIS_URL: "redis://cache:6379" });

        await expect(redis.safeSet("key", "val")).resolves.toBe(false);
        await expect(redis.safeDel("key")).resolves.toBe(false);
    });
});
