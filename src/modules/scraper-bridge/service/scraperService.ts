import { v4 as uuidv4 } from "uuid";
import { prisma } from "@/lib/db";
import { browserManager } from "./browserManager";

// Types for the Ingestion Payload
export interface ShadowSignalPayload {
    source: string; // e.g., "reddit", "glassdoor"
    thread_url: string;
    content: string; // Post or comment text
    timestamp: string;
    metadata?: any;
}

export interface IngestionResult {
    success: boolean;
    frictionScore: number;
    isWarmLead: boolean;
    detectedICPs: string[];
    signalId: string;
}

const FRICTION_KEYWORDS = {
    HIGH: ["downtime", "crash", "lost data", "security breach", "hack", "slow support", "expensive"],
    MEDIUM: ["confusing", "manual", "spreadsheet", "import", "export", "glitch", "bug"],
    LOW: ["feature request", "alternative", "pricing"]
};

// Map keywords to our App's ICPs
const ICP_MAP: Record<string, string[]> = {
    "security_lead": ["breach", "hack", "security", "pii", "compliance"],
    "ops_manager": ["manual", "spreadsheet", "slow", "inefficient"],
    "cto": ["downtime", "crash", "scale", "legacy"]
};

class ShadowIngestionService {

    /**
     * Ingests a signal from an external scraper.
     * Calculates Karmic Gap (Friction) and maps to ICPs.
     */
    async ingestSignal(payload: ShadowSignalPayload): Promise<IngestionResult> {
        const signalId = uuidv4();
        console.log(`[ShadowIngestion] Processing signal from ${payload.source}: ${payload.thread_url}`);

        // 1. Calculate Friction Score (Karmic Gap)
        const frictionScore = this.calculateFriction(payload.content);

        // 2. Identify ICPs
        const detectedICPs = this.mapToICP(payload.content);

        // 3. Persist (Mock DB write for now, or real if schema existed)
        // In a real app, this would match `prisma.shadowSignal.create(...)`
        await this.logIngestion(signalId, payload, frictionScore, detectedICPs);

        return {
            success: true,
            frictionScore,
            isWarmLead: frictionScore > 60 && detectedICPs.length > 0,
            detectedICPs,
            signalId
        };
    }

    /**
     * Scrapes a URL and ingests the content as a signal.
     */
    async scrape(payload: { url: string; target?: string } | any): Promise<IngestionResult> {
        const url = payload.url || payload.thread_url;
        if (!url) throw new Error("URL is required for scraping");

        const pageId = uuidv4();
        let page;

        try {
            console.log(`[ShadowIngestion] Scraping URL: ${url}`);
            page = await browserManager.newPage(pageId);
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Basic content extraction - getting visible text
            const content = await page.evaluate(() => document.body.innerText);

            const signalPayload: ShadowSignalPayload = {
                source: "scraper_api",
                thread_url: url,
                content: content,
                timestamp: new Date().toISOString(),
                metadata: payload
            };

            return this.ingestSignal(signalPayload);
        } catch (error) {
            console.error(`[ShadowIngestion] Failed to scrape ${url}:`, error);
            throw error;
        } finally {
            if (page) {
                await browserManager.closePage(pageId);
            }
        }
    }

    /**
     * Batch scrapes multiple URLs.
     */
    async batchScrape(requests: any[]): Promise<IngestionResult[]> {
        const results: IngestionResult[] = [];
        // Limit concurrency? For now, sequential to be safe with resources
        for (const req of requests) {
            try {
                const result = await this.scrape(req);
                results.push(result);
            } catch (error) {
                console.error(`[ShadowIngestion] Batch scrape error for request:`, req, error);
                // Continue with other requests
            }
        }
        return results;
    }

    private calculateFriction(text: string): number {
        let score = 0;
        const lowerText = text.toLowerCase();

        FRICTION_KEYWORDS.HIGH.forEach(w => { if (lowerText.includes(w)) score += 30; });
        FRICTION_KEYWORDS.MEDIUM.forEach(w => { if (lowerText.includes(w)) score += 10; });
        FRICTION_KEYWORDS.LOW.forEach(w => { if (lowerText.includes(w)) score += 5; });

        // Cap at 100
        return Math.min(score, 100);
    }

    private mapToICP(text: string): string[] {
        const lowerText = text.toLowerCase();
        const foundICPs = new Set<string>();

        for (const [icp, keywords] of Object.entries(ICP_MAP)) {
            if (keywords.some(k => lowerText.includes(k))) {
                foundICPs.add(icp);
            }
        }
        return Array.from(foundICPs);
    }

    private async logIngestion(id: string, payload: ShadowSignalPayload, score: number, icps: string[]) {
        // Mock logging or Prisma call
        console.log(`[ShadowIngestion] Signal ${id} | Score: ${score} | ICPs: ${icps.join(", ")} | Content Preview: ${payload.content.substring(0, 50)}...`);
    }
}

export const shadowIngestionService = new ShadowIngestionService();
export const scraperService = shadowIngestionService;
