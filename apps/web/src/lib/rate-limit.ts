import { LRUCache } from "lru-cache";

type Options = {
    uniqueTokenPerInterval?: number;
    interval?: number;
};

export const rateLimit = (options?: Options) => {
    const tokenCache = new LRUCache({
        max: options?.uniqueTokenPerInterval || 500,
        ttl: options?.interval || 60000,
    });

    return {
        check: (limit: number, token: string) => {
            const tokenValue = tokenCache.get(token) as number[] | undefined;
            const current = tokenValue?.[0] || 0;
            const next = current + 1;

            tokenCache.set(token, [next]);

            return {
                isRateLimited: next > limit,
                currentUsage: next,
            };
        },
    };
};

// Global instance for AI endpoints (limit: 5 requests per minute per user)
export const aiLimiter = rateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500
});
