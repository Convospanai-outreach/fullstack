// Replay cache shared by every API process (roadmap 3.1 / I-07).
//
// replayCache.ts is per-process, so a replay sent to a different process got
// through. This also claims each key in Redis (SET NX PX): the first process to
// claim a key wins, for as long as the key could still pass its window check.
// The per-process cache stays in front of Redis, so a replay into the same
// process is still caught when Redis is unset, down or erroring; in those cases
// the per-process cache decides alone, as before. A Redis error fails open to it
// rather than rejecting every request.

import { logger } from "./logger";
import { getRedisClient } from "./redis";
import { createReplayCache } from "./replayCache";

export interface SharedReplayCache {
    /** Same contract as ReplayCache.claim, also checked across processes while Redis is up. */
    claim(key: string, expiresAt: number, now?: number): Promise<boolean>;
}

export function createSharedReplayCache(namespace: string): SharedReplayCache {
    const local = createReplayCache();

    return {
        async claim(key, expiresAt, now = Date.now()) {
            if (!local.claim(key, expiresAt, now)) return false;

            const client = await getRedisClient();
            if (!client || client.status !== "ready") return true;

            try {
                const ttlMs = Math.max(1, Math.ceil(expiresAt - now));
                const result = await client.set(`replay:${namespace}:${key}`, "1", "PX", ttlMs, "NX");
                return result === "OK";
            } catch (error) {
                logger.warn(`[ReplayCache] Redis claim failed for ${namespace}, using this process's cache only`, error);
                return true;
            }
        },
    };
}
