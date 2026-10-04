// Single-use key cache for replay protection (roadmap 3.5 / S-13, S-16).
//
// Per-process only: each API process keeps its own copy. sharedReplayCache.ts
// puts Redis behind it so a replay sent to another process is caught too
// (roadmap 3.1 / I-07). Imports stay relative/builtin-only because
// apps/web/tests/unit imports internalAuth.ts (and therefore this file) directly.

export interface ReplayCache {
    /**
     * Records `key` as used until `expiresAt` (epoch ms). Returns false if the key
     * was already recorded and has not expired yet, i.e. this is a replay.
     */
    claim(key: string, expiresAt: number, now?: number): boolean;
}

export function createReplayCache(maxEntries = 100_000): ReplayCache {
    // Map iteration is insertion order, which is only roughly expiry order:
    // callers derive expiresAt from a caller-supplied timestamp that may sit
    // anywhere in the skew window, so an expired entry can be queued behind a
    // live one and outlive the cheap head-of-queue sweep below.
    const entries = new Map<string, number>();
    let lastFullSweep = -Infinity;

    return {
        claim(key, expiresAt, now = Date.now()) {
            for (const [storedKey, storedExpiry] of entries) {
                if (storedExpiry > now) break;
                entries.delete(storedKey);
            }

            const existing = entries.get(key);
            if (existing !== undefined && existing > now) return false;
            entries.delete(key);

            // At the cap, drop every expired entry before evicting a live one. At
            // most once a second, so a flood can't turn each claim into a full scan.
            if (entries.size >= maxEntries && now - lastFullSweep >= 1000) {
                lastFullSweep = now;
                for (const [storedKey, storedExpiry] of entries) {
                    if (storedExpiry <= now) entries.delete(storedKey);
                }
            }

            // Bounded memory: when the cap is still full of live entries (a flood of
            // validly signed requests), drop the oldest rather than failing every
            // request closed.
            if (entries.size >= maxEntries) {
                const oldest = entries.keys().next().value;
                if (oldest !== undefined) entries.delete(oldest);
            }

            entries.set(key, expiresAt);
            return true;
        },
    };
}
