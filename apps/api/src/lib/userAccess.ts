import { prisma } from "@/lib/db";

// Account access as the superadmin panel sets it (User.suspendedAt / sessionVersion).
// Cached per user for 30 seconds so per-request checks cost one query per user
// per half-minute; a change made elsewhere takes effect within that window.
export type UserAccess = { suspended: boolean; sessionVersion: number };

const TTL_MS = 30_000;
const MAX_ENTRIES = 10_000;
const cache = new Map<string, { at: number; access: UserAccess | null }>();

/** null when the user doesn't exist. Throws on a DB error so callers can decide. */
export async function getUserAccess(userId: string): Promise<UserAccess | null> {
    const hit = cache.get(userId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.access;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { suspendedAt: true, sessionVersion: true } });
    const access = user ? { suspended: Boolean(user.suspendedAt), sessionVersion: user.sessionVersion ?? 0 } : null;
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
    cache.set(userId, { at: Date.now(), access });
    return access;
}

/** Drops the cached entry so this process sees a change immediately. */
export function forgetUserAccess(userId: string) {
    cache.delete(userId);
}

/** Tokens issued before sessionVersion existed carry none and count as version 0. */
export function sessionVersionMatches(access: UserAccess, tokenSessionVersion: unknown): boolean {
    return (typeof tokenSessionVersion === "number" ? tokenSessionVersion : 0) === access.sessionVersion;
}
