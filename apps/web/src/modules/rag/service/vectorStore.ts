import { prisma } from "@/lib/db";

type VectorResult = {
    id: string;
    content: string;
    similarity: number;
    metadata?: any;
};

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

export const vectorStore = {
    search: async (query?: string, teamId?: string, limit: number = 5): Promise<VectorResult[]> => {
        if (!query || !teamId) return [];

        const items = (await prisma.knowledgeItem.findMany({
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
        })) ?? [];

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
        return { success: true, id: item.id };
    },
    formatContext: (results?: VectorResult[]): string => {
        if (!results || results.length === 0) return "";
        return results.map((result) => result.content).join("\n");
    },
};
