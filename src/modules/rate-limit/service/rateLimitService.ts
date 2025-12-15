import { NextResponse } from "next/server";

interface RateLimitConfig {
    windowMs: number;
    maxRequests: number;
}

// In-memory store for MVP (Use Redis/Upstash in production)
const ipStore = new Map<string, { count: number; resetTime: number }>();

export class RateLimitService {
    private config: RateLimitConfig;

    constructor(config: RateLimitConfig = { windowMs: 60 * 1000, maxRequests: 100 }) {
        this.config = config;
    }

    checkLimit(identifier: string, limitOverride?: number, windowOverride?: number): { success: boolean; limit: number; remaining: number; reset: number } {
        const now = Date.now();
        const record = ipStore.get(identifier);

        const limit = limitOverride ?? this.config.maxRequests;
        const windowMs = windowOverride ?? this.config.windowMs;

        if (!record || now > record.resetTime) {
            // New window
            ipStore.set(identifier, {
                count: 1,
                resetTime: now + windowMs
            });
            return {
                success: true,
                limit: limit,
                remaining: limit - 1,
                reset: now + windowMs
            };
        }

        // Existing window
        // If window config changed dynamically or different route uses different window,
        // we might have mismatch, but for MVP assuming mostly consistent or shorter windows is fine.
        // Actually, strictly we should check if resetTime is far off, but let's keep it simple.

        if (record.count >= limit) {
            return {
                success: false,
                limit: limit,
                remaining: 0,
                reset: record.resetTime
            };
        }

        record.count++;
        return {
            success: true,
            limit: limit,
            remaining: limit - record.count,
            reset: record.resetTime
        };
    }

    // Helper to get current stats for Admin UI
    getStats() {
        const stats: any[] = [];
        ipStore.forEach((value, key) => {
            if (Date.now() < value.resetTime) {
                stats.push({ ip: key, ...value });
            }
        });
        return stats;
    }

    // Helper to update config dynamically
    updateConfig(newConfig: Partial<RateLimitConfig>) {
        this.config = { ...this.config, ...newConfig };
    }
}

export const rateLimitService = new RateLimitService();
