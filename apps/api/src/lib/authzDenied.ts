import { LRUCache } from "lru-cache";
import { logger } from "@/lib/logger";

// One line per user and requirement a minute: a client hammering a route it may not use must not
// become a flood of log lines. The line says who was refused and what was required, nothing else.
const recentlyLogged = new LRUCache<string, true>({ max: 1000, ttl: 60 * 1000 });

/** Records an access-denied (403) decision. `required` reads like "role:admin" or "permission:manage_sso". */
export function logAuthzDenied(userId: string, teamId: string | null, required: string) {
    const key = `${userId}:${teamId ?? ""}:${required}`;
    if (recentlyLogged.has(key)) return;
    recentlyLogged.set(key, true);
    logger.warn("authz.denied", { userId, teamId, required });
}
