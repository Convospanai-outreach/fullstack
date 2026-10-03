import { Redis } from "ioredis";

// Superadmin on/off switch for Redis, stored as a global FeatureFlag row. No row
// means "follow the server env" (on whenever a Redis URL resolves). The URL itself
// stays a server secret; the switch only decides whether we use it.
export const REDIS_SWITCH_KEY = "system_redis";
const SWITCH_TTL_MS = 30_000;
const CONNECT_TIMEOUT_MS = 2_000;
const RETRY_AFTER_FAILURE_MS = 60_000;

let redisClient: Redis | null = null;
let connecting: Promise<void> | null = null;
let nextAttemptAt = 0;
let lastFailure: { message: string; at: string } | null = null;
let warnedMissingUrl = false;

let switchValue: boolean | null = null;
let switchReadAt = 0;
let switchRead: Promise<void> | null = null;

function redisDisabledByServer(): boolean {
    const inCi = process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";
    return process.env["DISABLE_REDIS"] === "true" || inCi;
}

function resolveRedisUrl(): string | null {
    const explicit = (process.env["REDIS_URL"] || "").trim();
    if (explicit) {
        return process.env["NODE_ENV"] === "production"
            ? explicit
            : explicit.replace("redis://localhost", "redis://127.0.0.1");
    }

    if (redisDisabledByServer()) return null;

    if (process.env["NODE_ENV"] === "production") {
        if (!warnedMissingUrl) {
            warnedMissingUrl = true;
            console.error("CRITICAL: REDIS_URL is missing in production! Distributed features will be disabled.");
        }
        return null;
    }

    return "redis://127.0.0.1:6379";
}

// Refreshes the switch in the background so no request waits on the DB for it;
// on a DB error the last known value stands.
function refreshSwitch() {
    if (switchRead || Date.now() - switchReadAt < SWITCH_TTL_MS) return;
    switchRead = (async () => {
        try {
            const { prisma } = await import("@/lib/db");
            const row = await prisma.featureFlag.findUnique({ where: { key: REDIS_SWITCH_KEY }, select: { isEnabled: true } });
            switchValue = row ? row.isEnabled : null;
        } catch {
            // keep the last known value
        } finally {
            switchReadAt = Date.now();
            switchRead = null;
        }
    })();
}

// Error text without any connection string, so it is safe to show in the panel.
function failureMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message.replace(/rediss?:\/\/\S+/gi, "[redis url]").slice(0, 300);
}

function startConnect(url: string) {
    const client = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: CONNECT_TIMEOUT_MS,
        retryStrategy: (retries: number) => {
            if (retries > 10) {
                console.error("Redis: Max reconnection attempts reached");
                return null;
            }
            return Math.min(retries * 100, 3000);
        },
    });

    client.on("error", (err: Error) => {
        if (process.env["NODE_ENV"] !== "test" && client === redisClient) {
            console.error("Redis Client Error:", err);
        }
    });

    client.on("connect", () => {
        if (process.env["NODE_ENV"] !== "test") {
            console.log("Redis connected");
        }
    });

    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Redis connection timeout")), CONNECT_TIMEOUT_MS).unref()
    );
    connecting = Promise.race([client.connect(), timeout])
        .then(() => {
            redisClient = client;
            lastFailure = null;
        })
        .catch((error: unknown) => {
            if (process.env["NODE_ENV"] !== "test") {
                console.error("Failed to connect to Redis:", error);
            }
            lastFailure = { message: failureMessage(error), at: new Date().toISOString() };
            nextAttemptAt = Date.now() + RETRY_AFTER_FAILURE_MS;
            client.disconnect();
        })
        .finally(() => {
            connecting = null;
        });
}

/**
 * Returns a ready client or null, without ever waiting on a connection: if Redis
 * isn't connected yet, a single background attempt is started (at most once a
 * minute after a failure) and callers use their non-Redis fallback meanwhile.
 */
export async function getRedisClient(): Promise<Redis | null> {
    const url = resolveRedisUrl();
    if (!url) return null;

    refreshSwitch();
    if (switchValue === false) {
        if (redisClient) {
            const client = redisClient;
            redisClient = null;
            client.disconnect();
        }
        return null;
    }

    if (redisClient && redisClient.status === "end") redisClient = null;
    if (redisClient) return redisClient.status === "ready" ? redisClient : null;

    if (!connecting && Date.now() >= nextAttemptAt) startConnect(url);
    return null;
}

export type RedisState = "connected" | "connecting" | "unreachable" | "off" | "not_configured" | "disabled_by_server";

export interface RedisStatus {
    state: RedisState;
    /** The superadmin switch: false only when it was explicitly turned off. */
    switchEnabled: boolean;
    urlConfigured: boolean;
    disabledByServer: boolean;
    lastFailure: { message: string; at: string } | null;
    nextRetryAt: string | null;
}

/** This process's view of Redis. Never includes the URL. */
export function getRedisStatus(): RedisStatus {
    const disabledByServer = redisDisabledByServer() && !(process.env["REDIS_URL"] || "").trim();
    const urlConfigured = !!(process.env["REDIS_URL"] || "").trim();
    const url = resolveRedisUrl();
    let state: RedisState;
    if (!url) state = disabledByServer ? "disabled_by_server" : "not_configured";
    else if (switchValue === false) state = "off";
    else if (redisClient?.status === "ready") state = "connected";
    else if (connecting || redisClient || !lastFailure) state = "connecting";
    else state = "unreachable";

    return {
        state,
        switchEnabled: switchValue !== false,
        urlConfigured,
        disabledByServer,
        lastFailure,
        nextRetryAt: state === "unreachable" && nextAttemptAt > Date.now() ? new Date(nextAttemptAt).toISOString() : null,
    };
}

/**
 * Applies a switch change in this process right away (other processes pick it up
 * within SWITCH_TTL_MS). Turning it on retries immediately and waits for that
 * one attempt, so the panel can show whether it worked.
 */
export async function applyRedisSwitch(enabled: boolean): Promise<RedisStatus> {
    switchValue = enabled;
    switchReadAt = Date.now();
    if (enabled) {
        nextAttemptAt = 0;
        await getRedisClient();
        if (connecting) await connecting;
    } else {
        await getRedisClient();
    }
    return getRedisStatus();
}

/** Test-only: forget all connection and switch state. */
export function resetRedisStateForTests() {
    redisClient?.disconnect();
    redisClient = null;
    connecting = null;
    nextAttemptAt = 0;
    lastFailure = null;
    warnedMissingUrl = false;
    switchValue = null;
    switchReadAt = 0;
    switchRead = null;
}

export async function closeRedis() {
    if (redisClient && redisClient.status !== "end") {
        await redisClient.quit();
        redisClient = null;
    }
}

export async function safeGet(key: string): Promise<string | null> {
    try {
        const client = await getRedisClient();
        if (!client || client.status !== "ready") return null;
        return await client.get(key);
    } catch (error) {
        console.warn(`[Redis] safeGet failed for key ${key}:`, error);
        return null;
    }
}

export async function safeSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client || client.status !== "ready") return false;

        if (ttlSeconds) {
            await client.set(key, value, "EX", ttlSeconds);
        } else {
            await client.set(key, value);
        }
        return true;
    } catch (error) {
        console.warn(`[Redis] safeSet failed for key ${key}:`, error);
        return false;
    }
}

export async function safeDel(key: string): Promise<boolean> {
    try {
        const client = await getRedisClient();
        if (!client || client.status !== "ready") return false;
        await client.del(key);
        return true;
    } catch (error) {
        console.warn(`[Redis] safeDel failed for key ${key}:`, error);
        return false;
    }
}
