import { NetjanaMCPClient } from "./mcpClient";
import { SovereignFirewall } from "@/lib/ai/SovereignFirewall";
import { TOON } from "@/lib/ai/TOON";
import { prisma } from "@/lib/prisma";

/**
 * KnowledgeOrchestrator
 * The core agentic component that discovers, ingests, sterilizes, and prepares
 * knowledge context for AI operations.
 */
export class KnowledgeOrchestrator {
    private mcpClient: NetjanaMCPClient;

    constructor() {
        this.mcpClient = new NetjanaMCPClient();
    }

    /**
     * Prepares a highly optimized, sterilized context for a specific campaign and lead.
     */
    async getCampaignContext(campaignId: string, leadId: string): Promise<string> {
        try {
            // 1. Fetch Local Data (Campaign & Lead)
            const campaign = await prisma.campaign.findUnique({
                where: { id: campaignId },
                include: { team: true }
            });

            const lead = await prisma.lead.findUnique({
                where: { id: leadId }
            });

            if (!campaign || !lead) return "";

            // 2. Fetch External Intents via MCP (Netjana)
            await this.mcpClient.connect();
            const externalIntents = await this.mcpClient.getCustomerIntents(lead.email || "");
            await this.mcpClient.close();

            // 3. Assemble the payload
            const rawContext = {
                campaign: {
                    name: campaign.name,
                    description: campaign.description,
                    audience: campaign.audience
                },
                lead: {
                    name: lead.fullName,
                    title: lead.jobTitle,
                    company: lead.company,
                    email: lead.email
                },
                externalIntents: externalIntents.slice(0, 5) 
            };

            // 4. Data Sterilization (Remove PII) via SovereignFirewall
            // We use the 'mask' method which handles PII deterministic mapping
            const { safeContext } = await SovereignFirewall.mask(rawContext);
            const sterilizedObj = JSON.parse(safeContext);

            // 5. TOON Serialization (Minimize Token Cost)
            const toonContext = TOON.serializeTabular(sterilizedObj);

            return toonContext;
        } catch (error) {
            console.error("Knowledge Orchestration failed:", error);
            return "ERROR_FETCHING_CONTEXT";
        }
    }
}
