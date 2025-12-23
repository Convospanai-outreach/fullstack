import { vectorStore } from "@/modules/rag/service/vectorStore";

export class RAGService {
    static async retrieveContext(query: string, teamId: string): Promise<string> {
        try {
            console.log(`[RAG] Retrieving context for query: "${query}" in team: ${teamId}`);

            const results = await vectorStore.search(query, teamId);

            if (results.length === 0) {
                console.log("[RAG] No relevant context found.");
                return "";
            }

            const context = results.map((doc: any) => doc.content).join("\n\n---\n\n");
            console.log(`[RAG] Found ${results.length} relevant snippets.`);

            return context;
        } catch (error) {
            console.error("RAG Retrieval Failed:", error);
            return "";
        }
    }
}
