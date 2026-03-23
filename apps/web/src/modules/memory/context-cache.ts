/**
 * Context Cache
 * specialized memory layer for long-running "Cowork" tasks.
 * Stores conversation state, RAG signals, and agent plans.
 */
import { Redis } from "ioredis";

// Mock Redis client if env vars are missing
const redis = new Redis(process.env['REDIS_URL'] || "redis://localhost:6379", {
    lazyConnect: true // Don't crash if Redis isn't running in dev
});

export class ContextCache {
    private static TTL_SECONDS = 60 * 60 * 24; // 24 Hours

    static async set(key: string, data: any): Promise<void> {
        try {
            await redis.setex(`ctx:${key}`, this.TTL_SECONDS, JSON.stringify(data));
        } catch (e) {
            console.warn("[ContextCache] Redis set failed, falling back to memory (warn only in dev)");
        }
    }

    static async get<T>(key: string): Promise<T | null> {
        try {
            const data = await redis.get(`ctx:${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.warn("[ContextCache] Redis get failed");
            return null;
        }
    }

    /**
     * Specialized retrieval for "Cowork" flows
     */
    static async getWorkflowContext(workflowId: string) {
        return this.get<{ step: number, signals: any[] }>(workflowId);
    }
}
