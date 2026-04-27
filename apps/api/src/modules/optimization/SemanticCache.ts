
import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { createHash } from "crypto";
import { LRUCache } from "lru-cache";

export class SemanticCache {
    private readonly SIMILARITY_THRESHOLD = 0.95;
    private lru = new LRUCache<string, string>({ max: 500 });

    /**
     * Retrieves a cached response if a semantically similar prompt exists.
     */
    async get(prompt: string): Promise<string | null> {
        try {
            // 0. Check in-memory LRU (Fastest)
            const memHit = this.lru.get(prompt);
            if (memHit) {
                console.log("[SemanticCache] in-memory hit");
                return memHit;
            }

            // 1. Check exact hash match first (DB)
            const promptHash = this.hashPrompt(prompt);
            const exactMatch = await prisma.lLMCache.findUnique({
                where: { promptHash }
            });

            if (exactMatch) {
                console.log("[SemanticCache] exact hit");
                this.lru.set(prompt, exactMatch.response);
                return exactMatch.response;
            }

            // 2. Semantic Search (Slower but catches rephrasing)
            const embedding = await aiService.getEmbeddings(prompt);
            if (!embedding || embedding.length === 0) return null;

            const embeddingSql = `[${embedding.join(",")}]`;

            // Using raw query for vector similarity
            const results: any[] = await prisma.$queryRawUnsafe(
                `SELECT id, response, (1 - (embedding <=> $1::vector)) as score
                 FROM "LLMCache"
                 WHERE (1 - (embedding <=> $1::vector)) > $2
                 ORDER BY score DESC
                 LIMIT 1`,
                embeddingSql,
                this.SIMILARITY_THRESHOLD
            );

            if (results.length > 0) {
                console.log(`[SemanticCache] semantic hit (score: ${results[0].score.toFixed(4)})`);
                this.lru.set(prompt, results[0].response);
                return results[0].response;
            }

            return null;
        } catch (error) {
            console.error("[SemanticCache] Get failed:", error);
            return null;
        }
    }

    /**
     * Caches a new response.
     */
    async set(prompt: string, response: string, tokensIn: number, tokensOut: number) {
        try {
            this.lru.set(prompt, response);
            const promptHash = this.hashPrompt(prompt);
            const embedding = await aiService.getEmbeddings(prompt);
            const embeddingSql = `[${embedding.join(",")}]`;

            // Using executeRaw to insert vector data
            await prisma.$executeRawUnsafe(
                `INSERT INTO "LLMCache" (id, prompt, "promptHash", response, embedding, "tokensIn", "tokensOut", "createdAt", "updatedAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, $6, NOW(), NOW())
                 ON CONFLICT ("promptHash") DO UPDATE 
                 SET response = $3, "updatedAt" = NOW()`,
                prompt,
                promptHash,
                response,
                embeddingSql,
                tokensIn,
                tokensOut
            );
        } catch (error) {
            console.error("[SemanticCache] Set failed:", error);
        }
    }

    private hashPrompt(prompt: string): string {
        return createHash("sha256").update(prompt.trim()).digest("hex");
    }
}

export const semanticCache = new SemanticCache();
