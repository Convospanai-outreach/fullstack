import { browserManager } from "./browserManager";
import { linkedinAdapter } from "./adapters/linkedinAdapter";
import { genericAdapter } from "./adapters/genericAdapter";
import { ScrapeRequest, ScrapeResult, ScrapeTarget } from "../types/scraper.types";
import { v4 as uuidv4 } from "uuid";

class ScraperService {
    private getAdapter(target: ScrapeTarget) {
        switch (target) {
            case "linkedin":
                return linkedinAdapter;
            case "generic":
            default:
                return genericAdapter;
        }
    }

    async scrape(request: ScrapeRequest): Promise<ScrapeResult> {
        const startTime = Date.now();
        const pageId = uuidv4();

        try {
            const adapter = this.getAdapter(request.target);

            if (!adapter.validate(request.url)) {
                throw new Error(`Invalid URL for target: ${request.target}`);
            }

            const page = await browserManager.newPage(pageId);

            // Set timeout
            page.setDefaultTimeout(request.options?.timeout || 30000);

            // Scrape data
            const data = await adapter.scrape(request.url, page, request.options);

            // Take screenshot if requested
            let screenshot: string | undefined;
            if (request.options?.screenshot) {
                const buffer = await page.screenshot({ encoding: "base64" });
                screenshot = buffer.toString();
            }

            await browserManager.closePage(pageId);

            return {
                success: true,
                data,
                ...(screenshot !== undefined ? { screenshot } : {}),
                metadata: {
                    url: request.url,
                    scrapedAt: new Date().toISOString(),
                    duration: Date.now() - startTime,
                },
            };
        } catch (error: any) {
            await browserManager.closePage(pageId);

            return {
                success: false,
                data: null,
                metadata: {
                    url: request.url,
                    scrapedAt: new Date().toISOString(),
                    duration: Date.now() - startTime,
                },
            };
        }
    }

    async batchScrape(requests: ScrapeRequest[]): Promise<ScrapeResult[]> {
        const results: ScrapeResult[] = [];

        for (const request of requests) {
            const result = await this.scrape(request);
            results.push(result);

            // Rate limiting: wait 2 seconds between requests
            await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        return results;
    }

    async cleanup() {
        await browserManager.close();
    }
}

export const scraperService = new ScraperService();
