import { prisma } from "@/lib/db";
import { vectorStore } from "./vectorStore";
import { aiService } from "@/lib/aiService";
import { TOON } from "@/lib/ai/TOON";

export class KnowledgeIngressService {
    /**
     * Ingests knowledge for a specific campaign.
     * Can pull from URLs, local files, or provided text.
     */
    static async ingressCampaignKnowledge(campaignId: string, source: string, type: 'URL' | 'TEXT' | 'FILE') {
        console.log(`[KnowledgeIngress] Ingesting knowledge for Campaign ${campaignId} from ${source}...`);

        let content = "";

        if (type === 'TEXT') {
            content = source;
        } else if (type === 'URL') {
            // In a real implementation, we'd use a scraper
            content = `Knowledge harvested from ${source} for campaign context.`;
        } else {
            content = `File content from ${source}`;
        }

        // 1. Data Sterilization via TOON
        const { optimizedPrompt: sterilized } = await TOON.process(content, "system");

        // 2. Generate Embeddings and Save to Vector Store
        const embedding = await aiService.getEmbeddings(sterilized);

        await vectorStore.addDocument({
            id: crypto.randomUUID(),
            content: sterilized,
            metadata: { 
                campaignId, 
                source, 
                type, 
                ingestedAt: new Date().toISOString() 
            },
            embedding
        });

        console.log(`[KnowledgeIngress] Knowledge for Campaign ${campaignId} indexed successfully.`);
    }

    /**
     * Agentic RAG Search:
     * Searches for campaign-specific knowledge before generation.
     */
    static async agenticSearch(campaignId: string, query: string) {
        // 1. Sterilize Query
        const { optimizedPrompt: safeQuery } = await TOON.process(query, "system");

        // 2. Vector Search
        const results = await vectorStore.search({
            query: safeQuery,
            limit: 5,
            filter: { campaignId }
        });

        return results.map(r => r.content).join("\n\n---\n\n");
    }
}
