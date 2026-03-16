import { prisma } from "@/lib/db";
import { aiService } from "@/modules/ai-content/service/aiService";

type VectorResult = {
    id: string;
    content: string;
    similarity: number;
    metadata?: any;
};

export const vectorStore = {
    search: async (query?: string, teamId?: string, limit: number = 5): Promise<VectorResult[]> => {
        if (!query || !teamId) return [];
        const embedding = await aiService.getEmbeddings(query);
        if (!embedding) return [];

        const results = await prisma.$queryRawUnsafe<any[]>(
            `
            SELECT id, content, metadata,
                   1 - (embedding <=> $1::vector) as similarity
            FROM "KnowledgeItem"
            WHERE "teamId" = $2
            ORDER BY similarity DESC
            LIMIT $3
            `,
            embedding,
            teamId,
            limit
        );

        return results.filter(r => r.similarity >= 0.5);
    },
    addDocument: async (content?: string, knowledgeBaseId?: string, metadata?: any): Promise<any> => {
        if (!content || !knowledgeBaseId) return { success: false };
        const item = await prisma.knowledgeItem.create({
            data: {
                content,
                metadata,
                knowledgeBaseId
            }
        });
        return { success: true, id: item.id };
    },
    formatContext: (results?: VectorResult[]): string => {
        if (!results || results.length === 0) return "";
        return results.map(r => r.content).join("\n");
    }
};
