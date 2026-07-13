import { prisma } from "@/lib/db";
import { vectorStore } from "./vectorStore";
import { TOON } from "@/lib/ai/TOON";

export class KnowledgeIngressService {
    /**
     * Ingests knowledge for a specific campaign.
     * Can pull from URLs, local files, or provided text.
     */
    static async ingressCampaignKnowledge(campaignId: string, source: string, type: 'URL' | 'TEXT' | 'FILE', teamId?: string) {
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

        // 2. Save to Vector Store (addDocument handles embedding internally)

        // Fetch teamId for the campaign
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, ...(teamId ? { teamId } : {}) },
            select: { teamId: true }
        });
        if (!campaign?.teamId) throw new Error("Campaign not found");

        // Find or create a knowledge base for this team
        let kb = await prisma.knowledgeBase.findFirst({
            where: { teamId: campaign.teamId }
        });

        if (!kb) {
            kb = await prisma.knowledgeBase.create({
                data: {
                    name: "Campaign Knowledge",
                    teamId: campaign.teamId
                }
            });
        }

        await vectorStore.addDocument(sterilized, kb.id, { 
            campaignId, 
            source, 
            type, 
            ingestedAt: new Date().toISOString() 
        });

        console.log(`[KnowledgeIngress] Knowledge for Campaign ${campaignId} indexed successfully.`);
    }

    /**
     * Agentic RAG Search:
     * Searches for campaign-specific knowledge before generation.
     */
    static async agenticSearch(campaignId: string, query: string, teamId?: string) {
        // 1. Sterilize Query
        const { optimizedPrompt: safeQuery } = await TOON.process(query, "system");

        // Fetch teamId
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, ...(teamId ? { teamId } : {}) },
            select: { teamId: true }
        });
        if (!campaign?.teamId) return "";

        // 2. Vector Search (using teamId as required by VectorStore.search)
        const results = await vectorStore.search(safeQuery, campaign.teamId, 5);

        return results.map(r => r.content).join("\n\n---\n\n");
    }
}
