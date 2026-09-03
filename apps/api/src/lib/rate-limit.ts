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

// Swarm launches spawn up to 30 concurrent agent_run jobs (one LLM call each) per request,
// far more expensive than a single aiLimiter-gated call - keyed by team, since the cost lands
// on the team's shared AI budget regardless of which member triggers it.
export const swarmLimiter = rateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500
});

// CSV import processes rows sequentially (a findFirst + create/update per row), so a
// large file can tie up a request for a long time - keyed by team, limit: 3 imports/min.
export const csvImportLimiter = rateLimit({
    interval: 60 * 1000, // 1 minute
    uniqueTokenPerInterval: 500
});
