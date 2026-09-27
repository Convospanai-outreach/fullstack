import type { FastifyRequest } from "fastify";
import type { RateLimitPluginOptions } from "@fastify/rate-limit";

/**
 * Global @fastify/rate-limit backstop (OPEN-274), registered in server.ts ahead
 * of every route. It runs in onRequest, before nextAdapter's per-route tiers and
 * before any token or signature check, so it also bounds unauthenticated traffic
 * to gated routes, which 401s before any tier is consulted.
 *
 * Keyed on the verified user, not the IP. Signed-in traffic reaches this API
 * through apps/web's /api/proxy on Render, so it arrives from Render's shared
 * outbound IPs (and, while TRUST_PROXY is off, from Caddy's own address). An IP
 * key would put every user in one bucket. Requests with no verified identity
 * fall back to the IP.
 *
 * The budget matches the AUTHENTICATED tier. It counts a key's requests across
 * all routes, so an admin's total is capped here too, below the ADMIN tier's
 * 5000/min.
 */
export const RATE_LIMIT_BACKSTOP = {
    max: 1000,
    timeWindowMs: 60_000,
} as const;

export function rateLimitBackstopOptions(
    verifiedUserId: (request: FastifyRequest) => Promise<string | undefined>,
): RateLimitPluginOptions {
    return {
        global: true,
        max: RATE_LIMIT_BACKSTOP.max,
        timeWindow: RATE_LIMIT_BACKSTOP.timeWindowMs,
        keyGenerator: async (request) => {
            const userId = await verifiedUserId(request);
            return userId ? `user:${userId}` : `ip:${request.ip}`;
        },
        // Same switch that turns off nextAdapter's per-route tiers.
        allowList: () => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true",
    };
}
