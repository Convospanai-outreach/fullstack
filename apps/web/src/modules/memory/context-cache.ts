/**
 * Context Cache
 * specialized memory layer for long-running "Cowork" tasks.
 * Stores conversation state, RAG signals, and agent plans.
 */
import { Redis } from "ioredis";

function resolveRedisUrl(): string | null {
    const explicit = (process.env["REDIS_URL"] || "").trim();
    if (explicit) return explicit;

    const inCi = process.env["CI"] === "true" || process.env["GITHUB_ACTIONS"] === "true";
    const isProd = process.env["NODE_ENV"] === "production";
    const disabled = process.env["DISABLE_REDIS"] === "true";

    if (disabled || inCi || isProd) return null;
    return "redis://localhost:6379";
}

let redis: Redis | null = null;
const inMemory = new Map<string, { value: string; expiresAt: number }>();

function getRedis(): Redis | null {
    const url = resolveRedisUrl();
    if (!url) return null;
    if (redis) return redis;

    redis = new Redis(url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
    });

    redis.on("error", (err) => {
        if (process.env["NODE_ENV"] !== "test") {
            console.warn("[ContextCache] Redis error (non-fatal):", err?.message || err);
        }
    });

    return redis;
}

export class ContextCache {
    private static TTL_SECONDS = 60 * 60 * 24; // 24 Hours

    static async set(key: string, data: any): Promise<void> {
        const payload = JSON.stringify(data);
        const cacheKey = `ctx:${key}`;
        const expiresAt = Date.now() + this.TTL_SECONDS * 1000;

        const client = getRedis();
        try {
            if (client) {
                await client.setex(cacheKey, this.TTL_SECONDS, payload);
                return;
            }
        } catch {
            if (process.env["NODE_ENV"] !== "test") {
                console.warn("[ContextCache] Redis set failed; using in-memory cache");
            }
        }

        inMemory.set(cacheKey, { value: payload, expiresAt });
    }

    static async get<T>(key: string): Promise<T | null> {
        const cacheKey = `ctx:${key}`;
        const client = getRedis();

        try {
            if (client) {
                const data = await client.get(cacheKey);
                return data ? JSON.parse(data) : null;
            }
        } catch {
            if (process.env["NODE_ENV"] !== "test") {
                console.warn("[ContextCache] Redis get failed; falling back to in-memory cache");
            }
        }

        const entry = inMemory.get(cacheKey);
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            inMemory.delete(cacheKey);
            return null;
        }

        try {
            return JSON.parse(entry.value) as T;
        } catch {
            return null;
        }
    }

    static async getWorkflowContext(workflowId: string) {
        return this.get<{ step: number; signals: any[] }>(workflowId);
    }
}

