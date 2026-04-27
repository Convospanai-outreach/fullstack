import { browserManager } from "@/modules/scraper-bridge/service/browserManager";
import { logger } from "@/lib/logger";

export class GenericAdapter {
    async scrape(url: string) {
        logger.info(`[GenericAdapter] Scraping URL: ${url}`);
        const page = await browserManager.getPage();
        try {
            await page.goto(url, { waitUntil: 'networkidle2' });
            const content = await page.content();
            return { content };
        } finally {
            await page.close();
        }
    }
}
