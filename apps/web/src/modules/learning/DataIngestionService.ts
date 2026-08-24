import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export class DataIngestionService {
    async processFileUpload(teamId: string, filePath: string, region: string = 'GLOBAL', campaignId?: string) {
        const res = await fetch(`${API_URL}/learning/ingest-file`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId, filePath, region, campaignId })
        });
        return await res.json();
    }

    async processEnrichmentJob(leadId: string, teamId: string, region: string = 'GLOBAL', campaignId?: string, extraction?: any) {
        return fetch(`${API_URL}/learning/enrich-lead`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId, teamId, region, campaignId, extraction })
        });
    }

    async recordFeedback(generationId: string, feedbackType: "COPY" | "THUMBS_UP" | "REPLY") {
        return fetch(`${API_URL}/learning/record-feedback`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ generationId, feedbackType })
        });
    }
}

export const dataIngestionService = new DataIngestionService();
