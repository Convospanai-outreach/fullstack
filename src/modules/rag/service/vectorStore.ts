import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";
import { v4 as uuidv4 } from 'uuid';

export type Document = {
    id: string;
    content: string;
    metadata?: any;
    embedding?: number[];
    similarity?: number;
};

export type FilteredResult = {
    id: string;
    content: string;
    metadata?: any;
    similarity: number;
    relevanceScore: number;
    tokenCount: number;
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

    /**
     * Estimate token count for text (rough approximation: 1 token ≈ 4 chars)
     */
    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 4);
    }

    /**
     * Calculate relevance score combining similarity and metadata signals
     */
    private calculateRelevance(item: any, query: string): number {
        let relevanceScore = item.similarity || item.score || 0;

        // Boost recent content
        if (item.metadata?.createdAt) {
            const ageInDays = (Date.now() - new Date(item.metadata.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 1 - (ageInDays / 365)); // Decay over 1 year
            relevanceScore += recencyBoost * 0.1;
        }

        // Boost content with matching keywords
        const queryTokens = query.toLowerCase().split(/\s+/);
        const contentLower = item.content.toLowerCase();
        const keywordMatches = queryTokens.filter(token => contentLower.includes(token)).length;
        const keywordBoost = (keywordMatches / queryTokens.length) * 0.15;
        relevanceScore += keywordBoost;

        return Math.min(1.0, relevanceScore);
    }

    /**
     * Filter and structure results to fit within token budget
     */
    private filterAndStructure(
        results: any[],
        query: string,
        maxTokens: number = 2000
    ): FilteredResult[] {
        const filtered: FilteredResult[] = [];
        let currentTokens = 0;

        // Sort by similarity first
        const sorted = results.sort((a, b) => (b.similarity || b.score || 0) - (a.similarity || a.score || 0));

        for (const item of sorted) {
            const tokenCount = this.estimateTokens(item.content);
            const relevanceScore = this.calculateRelevance(item, query);

            // Skip low-relevance items
            if (relevanceScore < 0.7) continue;

            // Check token budget
            if (currentTokens + tokenCount > maxTokens) {
                console.log(`[VectorStore] Token budget reached (${currentTokens}/${maxTokens}). Stopping retrieval.`);
                break;
            }

            filtered.push({
                id: item.id,
                content: item.content,
                metadata: item.metadata,
                similarity: item.similarity || item.score || 0,
                relevanceScore,
                tokenCount
            });

            currentTokens += tokenCount;
        }

        return filtered;
    }

    /**
     * Format results into structured, concise context
     */
    formatContext(results: FilteredResult[]): string {
        if (results.length === 0) return "";

        const sections = results.map((result, idx) => {
            const source = result.metadata?.source || result.metadata?.type || "Knowledge Base";
            return `[${idx + 1}] ${source} (Relevance: ${(result.relevanceScore * 100).toFixed(0)}%)\n${result.content.trim()}`;
        });

        return sections.join("\n\n---\n\n");
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
                    uuidv4(),
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

    async search(query: string, teamId: string, limit: number = 10, maxTokens: number = 2000) {
        const queryEmbedding = await aiService.getEmbeddings(query);

        if (!queryEmbedding || queryEmbedding.length === 0) return [];

        const embeddingSql = `[${queryEmbedding.join(",")}]`;

        // Efficient pgvector search with teamId isolation and model version check
        const results: any[] = await prisma.$queryRawUnsafe(
            `SELECT ki.id, ki.content, ki.metadata, 
                    (1 - (ki.embedding <=> $1::vector)) as similarity
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

        // Apply stricter grounding threshold
        const groundedResults = results.filter(item => item.similarity > 0.75);

        // Filter and structure within token budget
        return this.filterAndStructure(groundedResults, query, maxTokens);
    }
}

export const vectorStore = new VectorStore();
