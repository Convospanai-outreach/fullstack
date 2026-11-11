import { browserManager } from "@/modules/scraper-bridge/service/browserManager";
import { logger } from "@/lib/logger";
import { gotoPublicUrl } from "@/modules/scraper-bridge/service/safeNavigation";

export class GenericAdapter {
    async scrape(url: string) {
        logger.info(`[GenericAdapter] Scraping URL: ${url}`);
        const page = await browserManager.getPage();
        try {
            await gotoPublicUrl(page, url, { waitUntil: 'load' });
            // Short, bounded settle for late requests; busy pages never go idle, so don't fail on it.
            await page.waitForNetworkIdle({ idleTime: 500, timeout: 5000 }).catch(() => undefined);
            const content = await page.content();
            return { content };
        } finally {
            await page.close();
        }
    }
}
