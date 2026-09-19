export type RateLimitTierName = "AUTH" | "WEBHOOK" | "ERROR_LOGGING" | "ADMIN" | "AUTHENTICATED" | "PUBLIC";

export interface RateLimitTierResolution {
    tier: RateLimitTierName;
    endpoint: string;
    /**
     * true: key the rate limit by IP (pre-auth or inherently unauthenticated
     * tiers). false: key by the resolved userId (only known once the
     * caller's token has been verified).
     */
    keyByIp: boolean;
}

/**
 * Classifies a request into a rate-limit tier from the SAME registeredPath/
 * isPublic values nextAdapter (server.ts) already computes for auth-gating -
 * not an independently-maintained "/api"-prefixed path list. The old
 * apps/api/src/middleware.ts (removed - a Next.js middleware.ts file, which
 * never actually ran once this app moved to a bare `tsx server.ts` Fastify
 * process) checked things like `path.startsWith("/api/auth")`, but every
 * real registeredPath here is prefix-free (`/auth/...`, `/webhooks/...`,
 * `/admin/...`) - a literal port of that logic would have matched nothing
 * and silently rate-limited zero requests. Keying off the same values
 * nextAdapter already uses for auth means a new public-path alias (like the
 * existing /api/webhooks/netjana-intel one) can't drift the two checks out
 * of sync the way two independent path lists could.
 */
export function resolveRateLimitTier(registeredPath: string, isPublic: boolean): RateLimitTierResolution {
    if (registeredPath.startsWith("/auth")) {
        return { tier: "AUTH", endpoint: "auth", keyByIp: true };
    }
    if (registeredPath.startsWith("/webhooks") || registeredPath.startsWith("/api/webhooks")) {
        return { tier: "WEBHOOK", endpoint: "webhook", keyByIp: true };
    }
    if (registeredPath.startsWith("/errors/client")) {
        return { tier: "ERROR_LOGGING", endpoint: "error-logging", keyByIp: true };
    }
    if (registeredPath.startsWith("/admin")) {
        return { tier: "ADMIN", endpoint: "admin", keyByIp: false };
    }
    if (!isPublic) {
        return { tier: "AUTHENTICATED", endpoint: "authenticated", keyByIp: false };
    }
    return { tier: "PUBLIC", endpoint: "public", keyByIp: true };
}
