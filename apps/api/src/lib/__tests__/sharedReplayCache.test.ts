import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetRedisClient } = vi.hoisted(() => ({ mockGetRedisClient: vi.fn() }));
vi.mock("../redis", () => ({ getRedisClient: mockGetRedisClient }));

import { createSharedReplayCache } from "../sharedReplayCache";

const NOW = 1_800_000_000_000;
const EXPIRES = NOW + 5 * 60 * 1000;

/** The one Redis command the cache uses, SET key value PX ms NX, on one store shared by every "process". */
function fakeRedis() {
    const keys = new Set<string>();
    return {
        status: "ready",
        set: vi.fn(async (key: string) => {
            if (keys.has(key)) return null;
            keys.add(key);
            return "OK";
        }),
    };
}

describe("createSharedReplayCache (roadmap 3.1 / I-07)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("catches a replay sent to a different process", async () => {
        mockGetRedisClient.mockResolvedValue(fakeRedis());
        const processA = createSharedReplayCache("internal-auth");
        const processB = createSharedReplayCache("internal-auth");

        expect(await processA.claim("nonce-1", EXPIRES, NOW)).toBe(true);
        expect(await processB.claim("nonce-1", EXPIRES, NOW)).toBe(false);
    });

    it("stores the key namespaced, only for the rest of its window, and only if absent", async () => {
        const redis = fakeRedis();
        mockGetRedisClient.mockResolvedValue(redis);

        await createSharedReplayCache("scraper-ingest").claim("sig", EXPIRES, NOW);

        expect(redis.set).toHaveBeenCalledWith("replay:scraper-ingest:sig", "1", "PX", 5 * 60 * 1000, "NX");
    });

    it("keeps namespaces apart", async () => {
        mockGetRedisClient.mockResolvedValue(fakeRedis());

        expect(await createSharedReplayCache("internal-auth").claim("k", EXPIRES, NOW)).toBe(true);
        expect(await createSharedReplayCache("scraper-ingest").claim("k", EXPIRES, NOW)).toBe(true);
    });

    it("rejects a same-process replay before asking Redis", async () => {
        const redis = fakeRedis();
        mockGetRedisClient.mockResolvedValue(redis);
        const cache = createSharedReplayCache("internal-auth");

        await cache.claim("nonce-1", EXPIRES, NOW);
        expect(await cache.claim("nonce-1", EXPIRES, NOW + 1000)).toBe(false);
        expect(redis.set).toHaveBeenCalledTimes(1);
    });

    it("without Redis, still rejects a same-process replay (per-process cache, as before)", async () => {
        mockGetRedisClient.mockResolvedValue(null);
        const cache = createSharedReplayCache("internal-auth");

        expect(await cache.claim("nonce-1", EXPIRES, NOW)).toBe(true);
        expect(await cache.claim("nonce-1", EXPIRES, NOW + 1000)).toBe(false);
    });

    it("ignores a client that is not ready", async () => {
        const redis = { ...fakeRedis(), status: "reconnecting" };
        mockGetRedisClient.mockResolvedValue(redis);

        expect(await createSharedReplayCache("internal-auth").claim("nonce-1", EXPIRES, NOW)).toBe(true);
        expect(redis.set).not.toHaveBeenCalled();
    });

    it("on a Redis error, falls back to the per-process cache instead of rejecting", async () => {
        mockGetRedisClient.mockResolvedValue({ status: "ready", set: vi.fn().mockRejectedValue(new Error("ECONNRESET")) });
        const cache = createSharedReplayCache("internal-auth");

        expect(await cache.claim("nonce-1", EXPIRES, NOW)).toBe(true);
        expect(await cache.claim("nonce-1", EXPIRES, NOW + 1000)).toBe(false);
    });
});
