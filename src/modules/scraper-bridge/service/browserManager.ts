import puppeteer, { Browser, Page } from "puppeteer";

class BrowserManager {
    private browser: Browser | null = null;
    private pages: Map<string, Page> = new Map();
    private activePageCount = 0;
    private readonly MAX_PAGES = 5;

    async launch(options?: any) {
        if (this.browser) {
            return this.browser;
        }

        this.browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-accelerated-2d-canvas",
                "--no-first-run",
                "--no-zygote",
                "--disable-gpu",
                ...(options?.proxy ? [`--proxy-server=${options.proxy}`] : []),
            ],
        });

        return this.browser;
    }

    async newPage(id: string): Promise<Page> {
        if (this.activePageCount >= this.MAX_PAGES) {
            throw new Error(`[BrowserManager] Concurrency limit reached (${this.MAX_PAGES}). Throttling active.`);
        }

        this.activePageCount++;

        try {
            const browser = await this.launch();
            const page = await browser.newPage();

            // Anti-detection measures
            await page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            );

            await page.setViewport({ width: 1920, height: 1080 });

            // Block images and fonts to speed up scraping
            await page.setRequestInterception(true);
            page.on("request", (request) => {
                const resourceType = request.resourceType();
                if (["image", "font", "stylesheet"].includes(resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            this.pages.set(id, page);
            return page;
        } catch (error) {
            this.activePageCount--;
            throw error;
        }
    }

    async closePage(id: string) {
        const page = this.pages.get(id);
        if (page) {
            await page.close().catch(() => { });
            this.pages.delete(id);
            this.activePageCount--;
        }
    }

    async close() {
        for (const [id] of this.pages) {
            await this.closePage(id);
        }
        this.pages.clear();
        this.activePageCount = 0;

        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const browserManager = new BrowserManager();
