import { prisma } from "@/lib/db";
import { aiService } from "@/modules/ai-content/service/aiService";

export type Document = {
    id: string;
    content: string;
    metadata?: any;
    embedding?: number[];
};

class VectorStore {
    async addDocument(content: string, knowledgeBaseId: string, metadata?: any) {
        const embedding = await aiService.getEmbeddings(content);

        const doc = await prisma.knowledgeItem.create({
            data: {
                content,
                knowledgeBaseId,
                metadata: metadata || {},
                embedding: embedding as any
            }
        });

        return doc;
    }

    async search(query: string, teamId: string, limit: number = 5) {
        const queryEmbedding = await aiService.getEmbeddings(query);

        if (!queryEmbedding || queryEmbedding.length === 0) return [];

        // 1. Fetch relevant knowledge bases for the team
        const kbs = await prisma.knowledgeBase.findMany({
            where: { teamId },
            select: { id: true }
        });
        const kbIds = kbs.map((kb: { id: string }) => kb.id);

        if (kbIds.length === 0) return [];

        // 2. Fetch all items (Simplified for now - in production use pgvector)
        const items = await prisma.knowledgeItem.findMany({
            where: { knowledgeBaseId: { in: kbIds } }
        });

        // 3. Calculate similarity in-memory (OK for small sets)
        const results = items
            .map((item: any) => {
                const itemEmbedding = item.embedding as number[];
                if (!itemEmbedding) return { ...item, score: 0 };
                return {
                    ...item,
                    score: this.cosineSimilarity(queryEmbedding, itemEmbedding),
                };
            })
            .filter((item: any) => item.score > 0.5) // Minimum threshold
            .sort((a: any, b: any) => b.score - a.score)
            .slice(0, limit);

        return results;
    }

    private cosineSimilarity(a: number[], b: number[]) {
        if (a.length !== b.length) return 0;
        const dotProduct = a.reduce((sum: number, val: number, i: number) => sum + val * b[i], 0);
        const magnitudeA = Math.sqrt(a.reduce((sum: number, val: number) => sum + val * val, 0));
        const magnitudeB = Math.sqrt(b.reduce((sum: number, val: number) => sum + val * val, 0));
        if (magnitudeA === 0 || magnitudeB === 0) return 0;
        return dotProduct / (magnitudeA * magnitudeB);
    }
}

export const vectorStore = new VectorStore();
