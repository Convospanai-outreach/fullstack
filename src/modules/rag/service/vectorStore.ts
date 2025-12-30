import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";

export type Document = {
    id: string;
    content: string;
    metadata?: any;
    embedding?: number[];
};

class VectorStore {
    /**
     * Chunks text into smaller pieces for better retrieval resolution.
     */
    private chunkText(text: string, size: number = 1000, overlap: number = 200): string[] {
        const chunks: string[] = [];
        let start = 0;
        while (start < text.length) {
            const end = Math.min(start + size, text.length);
            chunks.push(text.substring(start, end));
            start += size - overlap;
        }
        return chunks;
    }

    async addDocument(content: string, knowledgeBaseId: string, metadata?: any) {
        const chunks = this.chunkText(content);
        const modelVersion = "embedding-001";

        for (const chunk of chunks) {
            try {
                const embedding = await aiService.getEmbeddings(chunk);
                const embeddingSql = `[${embedding.join(",")}]`;

                // Use raw SQL to insert the vector type with model versioning
                await prisma.$executeRawUnsafe(
                    `INSERT INTO "KnowledgeItem" (id, content, "knowledgeBaseId", metadata, embedding, "embeddingModel", version, "createdAt") 
                     VALUES ($1, $2, $3, $4::jsonb, $5::vector, $6, $7, NOW())`,
                    crypto.randomUUID(),
                    chunk,
                    knowledgeBaseId,
                    JSON.stringify(metadata || {}),
                    embeddingSql,
                    modelVersion,
                    1 // semantic version
                );
            } catch (error) {
                console.error(`❌ Failed to index chunk: ${chunk.substring(0, 50)}...`, error);
                // Continue to next chunk to maintain partial availability or throw if critical
            }
        }

        return { success: true, chunksCount: chunks.length };
    }

    async search(query: string, teamId: string, limit: number = 5) {
        const queryEmbedding = await aiService.getEmbeddings(query);

        if (!queryEmbedding || queryEmbedding.length === 0) return [];

        const embeddingSql = `[${queryEmbedding.join(",")}]`;

        // Efficient pgvector search with teamId isolation and model version check
        const results: any[] = await prisma.$queryRawUnsafe(
            `SELECT ki.id, ki.content, ki.metadata, 
                    (1 - (ki.embedding <=> $1::vector)) as score
             FROM "KnowledgeItem" ki
             JOIN "KnowledgeBase" kb ON ki."knowledgeBaseId" = kb.id
             WHERE kb."teamId" = $2 
             AND ki."embeddingModel" = $3
             ORDER BY ki.embedding <=> $1::vector
             LIMIT $4`,
            embeddingSql,
            teamId,
            "embedding-001",
            limit
        );

        return results.filter(item => item.score > 0.75); // Stricter grounding threshold for robustness
    }
}

export const vectorStore = new VectorStore();
