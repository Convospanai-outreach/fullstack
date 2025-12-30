import { prisma } from "@/lib/prisma";
import { getEmbeddings } from "@/ai/gemini";


// Simple cosine similarity since we are storing embeddings as JSON arrays for now
function cosineSimilarity(vecA: number[], vecB: number[]) {
    const dotProduct = vecA.reduce((sum, a, i) => sum + a * (vecB[i] ?? 0), 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    return dotProduct / (magnitudeA * magnitudeB);
}

export const knowledgeService = {
    async createKnowledgeBase(teamId: string, name: string, description?: string) {
        const data: any = {
            teamId,
            name
        };
        if (description) {
            data.description = description;
        }
        return prisma.knowledgeBase.create({ data });
    },

    async listKnowledgeBases(teamId: string) {
        return prisma.knowledgeBase.findMany({
            where: { teamId },
            include: { _count: { select: { items: true } } }
        });
    },

    async addDocument(knowledgeBaseId: string, content: string, metadata: any = {}) {
        // 1. Generate text embedding
        const embedding = await getEmbeddings(content);

        // 2. Save to DB
        return prisma.knowledgeItem.create({
            data: {
                knowledgeBaseId,
                content,
                embedding: embedding as any, // Stored as Json array
                metadata,
                embeddingModel: "gemini-1.5-flash"
            }
        });
    },

    async search(knowledgeBaseId: string, query: string, limit = 5) {
        // 1. Generate query embedding
        const queryEmbedding = await getEmbeddings(query);

        // 2. Fetch all items (Naive approach for MVP - acceptable for < 1000 docs)
        // For scale, we would use pgvector or Pinecone
        const items = await prisma.knowledgeItem.findMany({
            where: { knowledgeBaseId },
            select: { id: true, content: true, embedding: true, metadata: true }
        });

        // 3. Compute similarities
        const ranked = items
            .map(item => {
                const embedding = item.embedding as number[] | null;
                if (!embedding || !Array.isArray(embedding)) return { ...item, score: 0 };
                return {
                    ...item,
                    score: cosineSimilarity(queryEmbedding, embedding)
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);

        return ranked;
    },

    async deleteDocument(id: string) {
        return prisma.knowledgeItem.delete({ where: { id } });
    }
};
