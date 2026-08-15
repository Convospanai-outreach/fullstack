import { prisma } from "@/lib/db";
import { vectorStore } from "@/modules/rag/service/vectorStore";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

// Same lexical-overlap approach as vectorStore.ts's search (tokenize + token-overlap ratio),
// duplicated here because it's scoped to a single knowledgeBaseId rather than a whole team's
// knowledge bases, which vectorStore.search doesn't support.
function tokenize(value: string) {
    return value
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((token) => token.length >= 3);
}

function lexicalSimilarity(query: string, content: string) {
    const queryTokens = new Set(tokenize(query));
    if (queryTokens.size === 0) return 0;

    const contentTokens = new Set(tokenize(content));
    let overlap = 0;
    for (const token of queryTokens) {
        if (contentTokens.has(token)) overlap += 1;
    }

    return overlap / queryTokens.size;
}

export const knowledgeService = {
    async createKnowledgeBase(teamId: string, name: string, description?: string) {
        return prisma.knowledgeBase.create({
            data: { teamId, name, description }
        });
    },

    async listKnowledgeBases(teamId: string) {
        return prisma.knowledgeBase.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" }
        });
    },

    // Delegates to vectorStore.addDocument, which already implements this exact
    // create-a-KnowledgeItem operation (same model, same fields).
    async addDocument(knowledgeBaseId: string, content: string, metadata: any = {}) {
        return vectorStore.addDocument(content, knowledgeBaseId, metadata);
    },

    // Scoped to knowledgeBaseId only, matching the original self-fetch call's scoping
    // (the real caller - GET /knowledge/[id]/upload - performs no separate team check either).
    async search(knowledgeBaseId: string, query: string, limit = 5) {
        if (!knowledgeBaseId || !query) return [];

        const items = await prisma.knowledgeItem.findMany({
            where: { knowledgeBaseId },
            select: { id: true, content: true, metadata: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 200
        });

        return items
            .map((item) => ({
                id: item.id,
                content: item.content,
                // Field name "score" matches what apps/web's Knowledge Vault page
                // (apps/web/src/app/(dashboard)/knowledge/page.tsx) actually reads
                // off search results - not "similarity".
                score: lexicalSimilarity(query, item.content),
                metadata: item.metadata
            }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    },

    // NOT FIXED: self-fetches /knowledge/delete, which doesn't exist as a route, and has
    // zero callers anywhere in the codebase - the real KB-delete route
    // (DELETE /knowledge/[id]) bypasses this service entirely with its own direct
    // prisma.knowledgeBase.delete call. Left untouched rather than guessed at, matching
    // how 121721a left PipelineService.updateTask untouched for the same reason.
    async deleteDocument(id: string) {
        const res = await fetch(`${API_URL}/knowledge/delete`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id })
        });
        return await res.json();
    }
};
