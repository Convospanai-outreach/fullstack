import { browserManager } from "@/modules/scraper-bridge/service/browserManager";
import { logger } from "@/lib/logger";
import { gotoPublicUrl } from "@/modules/scraper-bridge/service/safeNavigation";

export class GenericAdapter {
    async scrape(url: string) {
        logger.info(`[GenericAdapter] Scraping URL: ${url}`);
        const page = await browserManager.getPage();
        try {
            await gotoPublicUrl(page, url, { waitUntil: 'networkidle2' });
            const content = await page.content();
            return { content };
        } finally {
            await page.close();
        }
    }
}
