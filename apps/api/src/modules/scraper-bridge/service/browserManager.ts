import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { logger } from '@/lib/logger';

puppeteer.use(StealthPlugin());

export class BrowserManager {
    private browser: any = null;
    private pages: Map<string, any> = new Map();

    async getBrowser() {
        if (!this.browser) {
            logger.info("[BrowserManager] Launching new stealth browser instance");
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--window-size=1920,1080'
                ]
            });
        }
        return this.browser;
    }

    async getPage() {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        return page;
    }

    async newPage(id: string) {
        if (this.pages.has(id)) {
            return this.pages.get(id);
        }
        const page = await this.getPage();
        this.pages.set(id, page);
        return page;
    }

    async closePage(id: string) {
        const page = this.pages.get(id);
        if (page) {
            await page.close();
            this.pages.delete(id);
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.pages.clear();
        }
    }
}

export const browserManager = new BrowserManager();
