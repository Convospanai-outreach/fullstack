
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");

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
            const res = await fetch(`${API_URL}/scraper/scrape`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload })
            });
            return await res.json();
        } catch (error) {
            console.error("Scrape proxy failed:", error);
            throw error;
        }
    }

    async batchScrape(requests: any[]): Promise<IngestionResult[]> {
        try {
            const res = await fetch(`${API_URL}/scraper/batch-scrape`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requests })
            });
            return await res.json();
        } catch (error) {
            console.error("Batch scrape proxy failed:", error);
            return [];
        }
    }
}

export const shadowIngestionService = new ShadowIngestionService();
export const scraperService = shadowIngestionService;
