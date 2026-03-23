import { getRedisClient } from "@/lib/redis";

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

export class RateLimitService {
    private config: RateLimitConfig;
    private fallbackMap: Map<string, { count: number; resetTime: number }> = new Map();

    constructor(config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 100 }) {
        this.config = config;
        this.startCleanup();
    }

    async checkLimit(
        identifier: string,
        limitOverride?: number,
        windowOverride?: number
    ): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
        const now = Date.now();
        const limit = limitOverride ?? this.config.maxRequests;
        const windowMs = windowOverride ?? this.config.windowMs;

        try {
            const redis = await getRedisClient();
            const windowKey = `ratelimit:${identifier}:${Math.floor(now / windowMs)}`;

            // Increment counter
            const count = await redis.incr(windowKey);

            // Set expiry on first request
            if (count === 1) {
                await redis.pExpire(windowKey, windowMs);
            }

            const reset = now + windowMs;

            return {
                success: count <= limit,
                limit,
                remaining: Math.max(0, limit - count),
                reset
            };
        } catch (error) {
            console.warn("Redis unavailable, using fallback rate limiting:", error);
            return this.checkLimitFallback(identifier, limit, windowMs, now);
        }
    }

    private checkLimitFallback(
        identifier: string,
        limit: number,
        windowMs: number,
        now: number
    ): { success: boolean; limit: number; remaining: number; reset: number } {
        const record = this.fallbackMap.get(identifier);

        if (!record || now > record.resetTime) {
            this.fallbackMap.set(identifier, {
                count: 1,
                resetTime: now + windowMs
            });
            return {
                success: true,
                limit,
                remaining: limit - 1,
                reset: now + windowMs
            };
        }

        if (record.count >= limit) {
            return {
                success: false,
                limit,
                remaining: 0,
                reset: record.resetTime
            };
        }

        record.count++;
        return {
            success: true,
            limit,
            remaining: limit - record.count,
            reset: record.resetTime
        };
    }

    async getStats() {
        try {
            const redis = await getRedisClient();
            const keys = await redis.keys("ratelimit:*");
            const stats = [];

            for (const key of keys) {
                const count = await redis.get(key);
                const ttl = await redis.ttl(key);
                stats.push({ key, count, ttl });
            }

            return stats;
        } catch (error) {
            const stats: any[] = [];
            this.fallbackMap.forEach((value, key) => {
                if (Date.now() < value.resetTime) {
                    stats.push({ ip: key, ...value });
                }
            });
            return stats;
        }
    }

    updateConfig(newConfig: Partial<RateLimitConfig>) {
        this.config = { ...this.config, ...newConfig };
    }

    private startCleanup() {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.fallbackMap.entries()) {
                if (now > value.resetTime) {
                    this.fallbackMap.delete(key);
                }
            }
        }, 60000); // Every minute
    }
}

export const rateLimitService = new RateLimitService();
