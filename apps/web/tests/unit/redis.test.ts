import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createClientMock = vi.hoisted(() => vi.fn());

vi.mock("redis", () => ({
    createClient: createClientMock,
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
    isOpen: boolean;
    connect: ReturnType<typeof vi.fn>;
    quit: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
}> = {}) {
    return {
        isOpen: false,
        connect: vi.fn(async function connect(this: { isOpen: boolean }) {
            this.isOpen = true;
        }),
        quit: vi.fn(async function quit(this: { isOpen: boolean }) {
            this.isOpen = false;
        }),
        destroy: vi.fn(function destroy(this: { isOpen: boolean }) {
            this.isOpen = false;
        }),
        get: vi.fn(async () => "value"),
        set: vi.fn(async () => "OK"),
        del: vi.fn(async () => 1),
        on: vi.fn(),
        ...overrides,
    };
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
        expect(createClientMock).not.toHaveBeenCalled();
    });

    it("does not create a client when redis is disabled or unavailable in CI", async () => {
        const disabled = await loadRedisModule({ DISABLE_REDIS: "true" });
        await expect(disabled.getRedisClient()).resolves.toBeNull();

        const ci = await loadRedisModule({ CI: "true" });
        await expect(ci.getRedisClient()).resolves.toBeNull();
    });

    it("connects, reuses, and closes an explicit redis client", async () => {
        const client = makeClient();
        createClientMock.mockReturnValue(client);
        const redis = await loadRedisModule({ REDIS_URL: "redis://localhost:6379" });

        await expect(redis.getRedisClient()).resolves.toBe(client);
        await expect(redis.getRedisClient()).resolves.toBe(client);
        expect(createClientMock).toHaveBeenCalledTimes(1);
        expect(createClientMock).toHaveBeenCalledWith(expect.objectContaining({ url: "redis://127.0.0.1:6379" }));

        await redis.closeRedis();
        expect(client.quit).toHaveBeenCalled();
    });

    it("destroys failed clients and lets safe helpers degrade gracefully", async () => {
        const client = makeClient({
            connect: vi.fn(async () => {
                throw new Error("boom");
            }),
        });
        createClientMock.mockReturnValue(client);
        const redis = await loadRedisModule({ REDIS_URL: "redis://127.0.0.1:6379" });

        await expect(redis.getRedisClient()).resolves.toBeNull();
        expect(client.destroy).toHaveBeenCalled();
        await expect(redis.safeGet("missing")).resolves.toBeNull();
        await expect(redis.safeSet("key", "value")).resolves.toBe(false);
        await expect(redis.safeDel("key")).resolves.toBe(false);
    });

    it("runs safe get/set/del against an open client", async () => {
        const client = makeClient({ isOpen: true });
        createClientMock.mockReturnValue(client);
        const redis = await loadRedisModule({ REDIS_URL: "redis://cache:6379" });

        await expect(redis.safeGet("key")).resolves.toBe("value");
        await expect(redis.safeSet("key", "value", 30)).resolves.toBe(true);
        await expect(redis.safeSet("key", "value")).resolves.toBe(true);
        await expect(redis.safeDel("key")).resolves.toBe(true);

        expect(client.set).toHaveBeenCalledWith("key", "value", { EX: 30 });
        expect(client.set).toHaveBeenCalledWith("key", "value");
        expect(client.del).toHaveBeenCalledWith("key");
    });

    it("catches errors in safeSet and safeDel when operations throw", async () => {
        const client = makeClient({
            isOpen: true,
            set: vi.fn(async () => { throw new Error("set error"); }),
            del: vi.fn(async () => { throw new Error("del error"); }),
        });
        createClientMock.mockReturnValue(client);
        const redis = await loadRedisModule({ REDIS_URL: "redis://cache:6379" });

        await expect(redis.safeSet("key", "val")).resolves.toBe(false);
        await expect(redis.safeDel("key")).resolves.toBe(false);
    });
});
