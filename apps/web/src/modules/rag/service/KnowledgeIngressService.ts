import { vectorStore } from "./vectorStore";
import { TOON } from "@/lib/ai/TOON";

export class KnowledgeIngressService {
    /**
     * Agentic RAG Search:
     * Searches for a team's knowledge before generation. Called by AgentExecutor
     * with the task's own teamId - previously mislabeled as campaignId and looked
     * up via a campaign relation that doesn't exist on AgentTask, so every real
     * call silently returned "".
     */
    static async agenticSearch(teamId: string, query: string) {
        const { optimizedPrompt: safeQuery } = await TOON.process(query, "system");
        const results = await vectorStore.search(safeQuery, teamId, 5);
        return results.map(r => r.content).join("\n\n---\n\n");
    }
}
