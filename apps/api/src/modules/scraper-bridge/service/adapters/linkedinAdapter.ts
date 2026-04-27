import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { logger } from "@/lib/logger";

export class LinkedInAdapter {
    async scrape(url: string) {
        logger.info(`[LinkedInAdapter] Scraping profile: ${url}`);
        const result = await runLinkedInAction({ action: "scrape", profileUrl: url });
        if (!result.ok) {
            throw new Error(result.error || "Scraping failed");
        }
        return result.data;
    }
}
