import { vectorStore } from "@/modules/rag/service/vectorStore";

export interface RAGOptions {
    maxTokens?: number;
    limit?: number;
    minRelevance?: number;
    strategy?: 'balanced' | 'precision';
}

export class RAGService {
    static async retrieveContext(
        query: string,
        teamId: string,
        options: RAGOptions = {}
    ): Promise<string> {
        const results = await vectorStore.search(query, teamId, options.limit ?? 5);
        const filtered = options.minRelevance !== undefined
            ? results.filter((r) => r.similarity >= options.minRelevance!)
            : results;
        return vectorStore.formatContext(filtered);
    }

    static async getRetrievalStats(query: string, teamId: string): Promise<any> {
        const results = await vectorStore.search(query, teamId);
        const totalResults = results.length;
        const avgSimilarity = totalResults > 0
            ? results.reduce((sum, r) => sum + r.similarity, 0) / totalResults
            : 0;
        return { totalResults, avgSimilarity };
    }
}
