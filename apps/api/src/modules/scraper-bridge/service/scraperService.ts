import { randomUUID } from "crypto";
import { LinkedInAdapter } from "./adapters/linkedinAdapter";
import { GenericAdapter } from "./adapters/genericAdapter";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';
const linkedInAdapter = new LinkedInAdapter();
const genericAdapter = new GenericAdapter();

export interface ShadowSignalPayload {
    source: string;
    thread_url: string;
    content: string;
    timestamp: string;
    metadata?: any;
}

export interface IngestionResult {
    success: boolean;
    frictionScore: number;
    isWarmLead: boolean;
    detectedICPs: string[];
    signalId: string;
    data?: any;
}

class ShadowIngestionService {
    async ingestSignal(payload: ShadowSignalPayload): Promise<IngestionResult> {
        try {
            const res = await fetch(`${API_URL}/scraper/ingest`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload })
            });
            return await res.json();
        } catch (error) {
            console.error("Signal ingestion proxy failed:", error);
            return { success: false } as any;
        }
    }

    async scrape(payload: any): Promise<IngestionResult> {
        try {
            const { target, url } = payload;
            const data = target === "linkedin"
                ? await linkedInAdapter.scrape(url)
                : await genericAdapter.scrape(url);

            return {
                success: true,
                data,
                frictionScore: 0,
                isWarmLead: false,
                detectedICPs: [],
                signalId: randomUUID(),
            };
        } catch (error) {
            console.error("Scrape failed:", error);
            throw error;
        }
    }

    async batchScrape(requests: any[]): Promise<IngestionResult[]> {
        try {
            return await Promise.all(requests.map((request) => this.scrape(request)));
        } catch (error) {
            console.error("Batch scrape failed:", error);
            return [];
        }
    }
}

export const shadowIngestionService = new ShadowIngestionService();
export const scraperService = shadowIngestionService;
