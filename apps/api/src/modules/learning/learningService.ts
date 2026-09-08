import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";
import { toVectorLiteral } from "@/lib/ai/vectorLiteral";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

const MEMORY_RELEVANCE_LIMIT = 8;

export class LearningService {
    // NOT FIXED: self-fetches /learning/feedback, and has zero callers anywhere in the
    // codebase - the real route (POST /learning/feedback) bypasses this service entirely
    // with its own direct prisma.agentFeedback.create call. Left untouched rather than
    // guessed at, matching how 121721a left PipelineService.updateTask untouched for the
    // same reason.
    static async recordFeedback(
        teamId: string,
        userId: string,
        messageId: string,
        rating: number,
        comment?: string
    ) {
        try {
            const res = await fetch(`${API_URL}/learning/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, userId, messageId, rating, comment })
            });
            if (!res.ok) throw new Error("Learning feedback failure");
            return await res.json();
        } catch (e) {
            console.error("Learning feedback proxy failed:", e);
        }
    }

    // Was self-fetching POST /learning/memories, which self-referentially calls this exact
    // service's route. Replaced with the same prisma.agentMemory query the live route
    // (GET /learning/memories) already runs.
    //
    // The live route returns raw AgentMemory rows ({ memories: [...] }), but every real
    // caller (emailComposer.ts's composeNodeA/B/C, and routes/inbox/suggest) types this as
    // string[] and does `.join("\n")` straight into an AI prompt - the route's own shape was
    // never actually consumable by its callers. Formatted each memory as "key: value",
    // mirroring the pairing already documented in the AgentMemory model's own schema comment
    // (e.g. "tone_preference": "Always use emojis").
    //
    // No try/catch here (unlike the old self-fetch's swallow-into-[]): a DB failure must
    // propagate rather than silently render "no memories" into every AI prompt, which the
    // caller couldn't distinguish from "this team genuinely has none yet." Matches the
    // analyticsService precedent (no try/catch; callers already have their own 500 handling).
    static async getMemories(teamId: string, queryText?: string) {
        if (!teamId) return [];

        if (queryText?.trim()) {
            try {
                const embedding = await aiService.getRagEmbedding(queryText, teamId);
                const results = await prisma.$queryRawUnsafe<Array<{ key: string; value: string }>>(
                    `SELECT key, value
                     FROM "AgentMemory"
                     WHERE "teamId" = $1 AND embedding IS NOT NULL
                     ORDER BY embedding <=> $2::vector
                     LIMIT $3`,
                    teamId,
                    toVectorLiteral(embedding),
                    MEMORY_RELEVANCE_LIMIT
                );
                if (results.length > 0) {
                    return results.map((m) => `${m.key}: ${m.value}`);
                }
            } catch (error: any) {
                logger.warn("[LearningService] Relevance-ranked memory lookup unavailable, falling back to all memories", {
                    teamId,
                    error: error?.message ?? String(error),
                });
            }
        }

        const memories = await prisma.agentMemory.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" }
        });

        return memories.map((m) => `${m.key}: ${m.value}`);
    }

    /**
     * Single write path for AgentMemory so embedding population (for
     * getMemories' relevance ranking) happens exactly once, instead of each
     * caller duplicating a raw prisma.agentMemory.create and forgetting it.
     * Best-effort: an embedding failure must not block the memory being saved.
     */
    static async saveMemory(teamId: string, key: string, value: string, confidence = 1.0) {
        const memory = await prisma.agentMemory.create({
            data: { teamId, key, value, confidence }
        });

        try {
            const embedding = await aiService.getRagEmbedding(`${key}: ${value}`, teamId);
            await prisma.$executeRawUnsafe(
                `UPDATE "AgentMemory" SET embedding = $1::vector WHERE id = $2`,
                toVectorLiteral(embedding),
                memory.id
            );
        } catch (error: any) {
            logger.warn("[LearningService] Failed to embed new memory, it will only surface via the recency fallback", {
                teamId,
                memoryId: memory.id,
                error: error?.message ?? String(error),
            });
        }

        return memory;
    }
}
