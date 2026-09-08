import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

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
        try {
            const res = await fetch(`${API_URL}/rag/retrieve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, teamId, options })
            });
            if (!res.ok) throw new Error("RAG proxy failure");
            const data = await res.json();
            return data.context || "";
        } catch (e) {
            console.error("RAG retrieval proxy failed:", e);
            return "";
        }
    }

    static async getRetrievalStats(query: string, teamId: string): Promise<any> {
        try {
            const res = await fetch(`${API_URL}/rag/stats`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query, teamId })
            });
            if (!res.ok) throw new Error("RAG stats failure");
            return await res.json();
        } catch (e) {
            console.error("RAG stats proxy failed:", e);
            return null;
        }
    }
}
