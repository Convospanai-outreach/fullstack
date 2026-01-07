import { vectorStore } from '@/modules/rag/service/vectorStore';

/**
 * Vector Search Wrapper
 * Delegates to the RAG module's VectorStore for semantic search.
 * @param query - The search query
 * @param teamId - Optional team ID for tenant isolation
 * @param limit - Maximum number of results to return
 */
export async function searchSimilar(
  query: string,
  teamId?: string,
  limit: number = 5
) {
  if (!teamId) {
    console.warn('[VectorStore] No teamId provided, returning empty results for security');
    return [];
  }

  return vectorStore.search(query, teamId, limit);
}
