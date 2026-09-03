import { getBrowserApiBase } from "@/lib/api/browserBase";
const API_URL =
    process.env["API_INTERNAL_ORIGIN"]
    || process.env["API_BASE_URL"]
    || getBrowserApiBase();

export class KnowledgeOrchestrator {
    static async search(teamId: string, query: string) {
        try {
            const res = await fetch(`${API_URL}/knowledge/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, query })
            });
            return await res.json();
        } catch {
            return [];
        }
    }

    static async ingest(teamId: string, content: string, source: string) {
        try {
            const res = await fetch(`${API_URL}/knowledge/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, content, source })
            });
            return await res.json();
        } catch (error) {
            console.error("Knowledge ingestion proxy failed:", error);
            throw error;
        }
    }

    async getCampaignContext(campaignId: string, leadId: string) {
        try {
            const res = await fetch(`${API_URL}/knowledge/campaign-context`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId, leadId })
            });
            const data = await res.json();
            return data.context || "";
        } catch {
            return "";
        }
    }
}
