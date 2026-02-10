import { vectorStore } from "@/modules/rag/service/vectorStore";
import { OutcomeRAGService } from "@/modules/rag/service/OutcomeRAGService";

export interface RAGOptions {
    maxTokens?: number;
    limit?: number;
    minRelevance?: number;
    strategy?: 'balanced' | 'precision';
}

export class RAGService {
    /**
     * Retrieve concise, relevant, and grounded context for agent generation.
     * Applies filtering, ranking, and structuring before hitting context window.
     */
    static async retrieveContext(
        query: string,
        teamId: string,
        options: RAGOptions = {}
    ): Promise<string> {
        try {
            const { maxTokens = 2000, limit = 10, strategy = 'balanced' } = options;

            // Bulls-Eye Logic: Dynamic Threshold
            // If strategy is precision, we enforce strict relevance (0.85)
            // If balanced, we use standard (0.7)
            const minRelevance = options.minRelevance ?? (strategy === 'precision' ? 0.85 : 0.7);

            console.log(`[RAG] Retrieving context for query: "${query}" in team: ${teamId}`);
            console.log(`[RAG] Strategy: ${strategy}, Threshold: ${minRelevance}`);

            // Step 1: Vector search with token budget
            const results = await vectorStore.search(query, teamId, limit, maxTokens);

            if (results.length === 0) {
                console.log("[RAG] No relevant context found.");
                return "";
            }

            // Step 2: Filter by relevance threshold
            const relevantResults = results.filter(r => r.relevanceScore >= minRelevance);

            if (relevantResults.length === 0) {
                console.log(`[RAG] No results met relevance threshold (${minRelevance}).`);
                return "";
            }

            // Step 3: Re-rank based on outcome weights
            const itemIds = relevantResults.map(r => r.id);
            const { prisma } = await import("@/lib/db"); // Lazy import to avoid cycle if any
            const performanceData = await prisma.knowledgePerformance.findMany({
                where: { knowledgeItemId: { in: itemIds } }
            });

            const rankedResults = OutcomeRAGService.rankResults(relevantResults, performanceData);

            // Step 4: Format into structured context
            const context = vectorStore.formatContext(rankedResults);

            const totalTokens = rankedResults.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
            console.log(`[RAG] Retrieved ${rankedResults.length} snippets (${totalTokens} tokens, Outcome-Weighted).`);

            return context;
        } catch (error) {
            console.error("RAG Retrieval Failed:", error);
            return "";
        }
    }

    /**
     * Get retrieval statistics for monitoring and debugging
     */
    static async getRetrievalStats(query: string, teamId: string): Promise<any> {
        try {
            const results = await vectorStore.search(query, teamId, 10, 2000);
            const { prisma } = await import("@/lib/db");
            const itemIds = results.map(r => r.id);
            const performanceData = await prisma.knowledgePerformance.findMany({
                where: { knowledgeItemId: { in: itemIds } }
            });
            const rankedResults = OutcomeRAGService.rankResults(results, performanceData);

            return {
                totalResults: results.length,
                rankedResults: rankedResults.length,
                avgRelevance: results.reduce((sum, r) => sum + r.relevanceScore, 0) / results.length || 0,
                avgSimilarity: results.reduce((sum, r) => sum + r.similarity, 0) / results.length || 0,
                totalTokens: results.reduce((sum, r) => sum + r.tokenCount, 0)
            };
        } catch (error) {
            console.error("Failed to get retrieval stats:", error);
            return null;
        }
    }
}
