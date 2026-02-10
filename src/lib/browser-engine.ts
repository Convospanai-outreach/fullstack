import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import { BrowserSandbox } from "@/lib/security/BrowserSandbox";

puppeteer.use(StealthPlugin());

export class BrowserEngine {
    private static instance: BrowserEngine;
    private browser: Browser | null = null;

    private constructor() { }

    public static getInstance(): BrowserEngine {
        if (!BrowserEngine.instance) {
            BrowserEngine.instance = new BrowserEngine();
        }
        return BrowserEngine.instance;
    }

    /**
     * Launches or retrieves the existing browser instance.
     */
    public async getBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.isConnected()) {
            console.log("🚀 Launching new browser instance...");

            // Use BrowserSandbox for secure launch
            this.browser = await BrowserSandbox.launch({
                maxMemory: 512,
                sessionTimeout: 600000, // 10 minutes for agent tasks
                enableSandbox: process.env.ENABLE_BROWSER_SANDBOX === 'true' || process.env.NODE_ENV === 'production',
                blockedDomains: ['doubleclick.net', 'googleadservices.com', 'googlesyndication.com']
            });

            // Handle disconnect
            this.browser.on("disconnected", () => {
                console.log("❌ Browser disconnected.");
                this.browser = null;
            });

            console.log(BrowserSandbox.getEnvironmentGuidance());
        }
        return this.browser;
    }

    /**
     * Creates a new page and ensures context is clean.
     */
    public async getPage(): Promise<Page> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        // Anti-detection overrides (Double check, although stealth plugin handles most)
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", {
                get: () => false,
            });
        });

        // Set viewport
        await page.setViewport({ width: 1366, height: 768 });

        return page;
    }

    /**
     * Closes the browser instance.
     */
    public async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}
