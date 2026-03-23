import { NextResponse } from "next/server";

// Simple Memory-based rate limiter for development
// In production, this should use Redis (Upstash) for distributed systems
const memoryStore = new Map<string, { count: number, resetAt: number }>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;

export async function checkApiRateLimit(key: string) {
    const now = Date.now();
    const record = memoryStore.get(key);

    if (!record || now > record.resetAt) {
        memoryStore.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return { success: true, remaining: MAX_REQUESTS - 1 };
    }

    if (record.count >= MAX_REQUESTS) {
        return { success: false, remaining: 0, resetIn: Math.ceil((record.resetAt - now) / 1000) };
    }

    record.count++;
    return { success: true, remaining: MAX_REQUESTS - record.count };
}

export function rateLimitResponse(resetIn: number) {
    return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
            status: 429,
            headers: {
                "Retry-After": resetIn.toString(),
                "X-RateLimit-Limit": MAX_REQUESTS.toString(),
            }
        }
    );
}
