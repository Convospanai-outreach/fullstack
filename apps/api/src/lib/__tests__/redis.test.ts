import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { instances, findUnique } = vi.hoisted(() => ({ instances: [] as any[], findUnique: vi.fn() }));

vi.mock("ioredis", () => ({
    Redis: class {
        status = "wait";
        connectResult: { resolve: () => void; reject: (e: Error) => void } | null = null;
        constructor(public url: string) {
            instances.push(this);
        }
        on() {
            return this;
        }
        connect() {
            return new Promise<void>((resolve, reject) => {
                this.connectResult = {
                    resolve: () => {
                        this.status = "ready";
                        resolve();
                    },
                    reject,
                };
            });
        }
        disconnect() {
            this.status = "end";
        }
    },
}));
vi.mock("@/lib/db", () => ({ prisma: { featureFlag: { findUnique } } }));

import { applyRedisSwitch, getRedisClient, getRedisStatus, resetRedisStateForTests } from "../redis";

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("redis client", () => {
    beforeEach(() => {
        instances.length = 0;
        findUnique.mockReset().mockResolvedValue(null);
        resetRedisStateForTests();
        vi.stubEnv("REDIS_URL", "redis://:hunter2@redis.example:6379");
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("never makes a caller wait for a connection, and retries a dead host at most once a minute", async () => {
        const started = Date.now();
        expect(await getRedisClient()).toBeNull();
        expect(Date.now() - started).toBeLessThan(50);
        expect(instances).toHaveLength(1);

        instances[0].connectResult.reject(new Error("connect ETIMEDOUT redis://:hunter2@redis.example:6379"));
        await flush();

        expect(await getRedisClient()).toBeNull();
        expect(instances).toHaveLength(1);
        const status = getRedisStatus();
        expect(status.state).toBe("unreachable");
        expect(status.lastFailure?.message).toBe("connect ETIMEDOUT [redis url]");
        expect(status.nextRetryAt).not.toBeNull();
        expect(JSON.stringify(status)).not.toContain("hunter2");
    });

    it("hands out the client once it is ready", async () => {
        await getRedisClient();
        instances[0].connectResult.resolve();
        await flush();
        expect(await getRedisClient()).toBe(instances[0]);
        expect(getRedisStatus().state).toBe("connected");
    });

    it("the superadmin switch turns it off and back on", async () => {
        await getRedisClient();
        instances[0].connectResult.resolve();
        await flush();

        const off = await applyRedisSwitch(false);
        expect(off).toMatchObject({ state: "off", switchEnabled: false });
        expect(instances[0].status).toBe("end");
        expect(await getRedisClient()).toBeNull();

        const turningOn = applyRedisSwitch(true);
        await flush();
        instances[1].connectResult.resolve();
        expect(await turningOn).toMatchObject({ state: "connected", switchEnabled: true });
    });

    it("reads the switch from the database in the background", async () => {
        findUnique.mockResolvedValue({ isEnabled: false });
        expect(await getRedisClient()).toBeNull();
        await flush();
        expect(findUnique).toHaveBeenCalledWith({ where: { key: "system_redis" }, select: { isEnabled: true } });
        expect(getRedisStatus().state).toBe("off");
        expect(await getRedisClient()).toBeNull();
    });

    it("reports a production server without a Redis URL as not configured, logging once", async () => {
        vi.stubEnv("REDIS_URL", "");
        vi.stubEnv("CI", "");
        vi.stubEnv("GITHUB_ACTIONS", "");
        vi.stubEnv("NODE_ENV", "production");
        await getRedisClient();
        await getRedisClient();
        expect(getRedisStatus()).toMatchObject({ state: "not_configured", urlConfigured: false });
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(instances).toHaveLength(0);
    });
});
