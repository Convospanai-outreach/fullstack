import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { aiService } from "@/lib/aiService";

type VectorResult = {
    id: string;
    content: string;
    similarity: number;
    metadata?: any;
};

function toVectorLiteral(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
}

function tokenize(value: string) {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);
}

function lexicalSimilarity(query: string, content: string) {
    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) {
        return 0;
    }

    const contentTokens = new Set(tokenize(content));
    let overlap = 0;
    for (const token of queryTokens) {
        if (contentTokens.has(token)) {
            overlap += 1;
        }
    }

    return overlap / queryTokens.size;
}

async function lexicalSearch(query: string, teamId: string, limit: number): Promise<VectorResult[]> {
    const items = await prisma.knowledgeItem.findMany({
        where: {
            knowledgeBase: {
                teamId,
            },
        },
        select: {
            id: true,
            content: true,
            metadata: true,
            createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
    });

    return items
        .map((item) => ({
            id: item.id,
            content: item.content,
            similarity: lexicalSimilarity(query, item.content),
            metadata: item.metadata,
        }))
        .filter((item) => item.similarity > 0)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
}

export const vectorStore = {
    search: async (query?: string, teamId?: string, limit: number = 5): Promise<VectorResult[]> => {
        if (!query || !teamId) return [];

        try {
            const embedding = await aiService.getRagEmbedding(query, teamId);
            const results = await prisma.$queryRawUnsafe<VectorResult[]>(
                `SELECT ki.id, ki.content, ki.metadata,
                        1 - (ki.embedding <=> $1::vector) AS similarity
                 FROM "KnowledgeItem" ki
                 JOIN "KnowledgeBase" kb ON ki."knowledgeBaseId" = kb.id
                 WHERE kb."teamId" = $2 AND ki.embedding IS NOT NULL
                 ORDER BY ki.embedding <=> $1::vector
                 LIMIT $3`,
                toVectorLiteral(embedding),
                teamId,
                limit
            );
            if (results.length > 0) return results;
        } catch (error: any) {
            logger.warn("[vectorStore] Vector search unavailable, falling back to lexical search", {
                teamId,
                error: error?.message ?? String(error),
            });
        }

        // No OpenAI key configured, or no items have been embedded yet
        // (ingested before this store started embedding, or embedding
        // failed at write time) - fall back to keyword overlap rather than
        // returning nothing.
        return lexicalSearch(query, teamId, limit);
    },
    addDocument: async (content?: string, knowledgeBaseId?: string, metadata?: any): Promise<any> => {
        if (!content || !knowledgeBaseId) return { success: false };
        const item = await prisma.knowledgeItem.create({
            data: {
                content,
                metadata,
                knowledgeBaseId,
            },
        });

        try {
            const kb = await prisma.knowledgeBase.findUnique({
                where: { id: knowledgeBaseId },
                select: { teamId: true },
            });
            if (kb?.teamId) {
                const embedding = await aiService.getRagEmbedding(content, kb.teamId);
                await prisma.$executeRawUnsafe(
                    `UPDATE "KnowledgeItem" SET embedding = $1::vector WHERE id = $2`,
                    toVectorLiteral(embedding),
                    item.id
                );
            }
        } catch (error: any) {
            // Best-effort: the item is already created and stays lexically
            // searchable via the fallback above - an embedding failure must
            // not fail the ingest.
            logger.warn("[vectorStore] Failed to embed new document, leaving it lexical-only", {
                knowledgeBaseId,
                itemId: item.id,
                error: error?.message ?? String(error),
            });
        }

        return { success: true, id: item.id };
    },
    formatContext: (results?: VectorResult[]): string => {
        if (!results || results.length === 0) return "";
        return results.map((result) => result.content).join("\n");
    },
};
