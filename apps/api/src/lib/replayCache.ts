// Single-use key cache for replay protection (roadmap 3.5 / S-13, S-16).
//
// Per-process only: each API process keeps its own copy, so a replay sent to a
// different host/process is not caught. Moving this to the shared Redis client
// is roadmap 3.1 / I-07. Imports stay relative/builtin-only because
// apps/web/tests/unit imports internalAuth.ts (and therefore this file) directly.

export interface ReplayCache {
    /**
     * Records `key` as used until `expiresAt` (epoch ms). Returns false if the key
     * was already recorded and has not expired yet, i.e. this is a replay.
     */
    claim(key: string, expiresAt: number, now?: number): boolean;
}

export function createReplayCache(maxEntries = 100_000): ReplayCache {
    // Map iteration is insertion order, which is roughly expiry order because
    // callers derive expiresAt from a timestamp that must be close to "now".
    const entries = new Map<string, number>();

    return {
        claim(key, expiresAt, now = Date.now()) {
            for (const [storedKey, storedExpiry] of entries) {
                if (storedExpiry > now) break;
                entries.delete(storedKey);
            }

            const existing = entries.get(key);
            if (existing !== undefined && existing > now) return false;
            entries.delete(key);

            // Bounded memory: under a flood, drop the oldest entry rather than
            // failing every request closed.
            if (entries.size >= maxEntries) {
                const oldest = entries.keys().next().value;
                if (oldest !== undefined) entries.delete(oldest);
            }

            entries.set(key, expiresAt);
            return true;
        },
    };
}
