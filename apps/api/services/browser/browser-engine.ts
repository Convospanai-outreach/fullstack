
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { Browser, Page } from "puppeteer";
import { BrowserSandbox } from "./BrowserSandbox.js";

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

    public async getBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.isConnected()) {
            this.browser = await BrowserSandbox.launch({
                maxMemory: 512,
                sessionTimeout: 600000,
                enableSandbox: true,
            });

            this.browser.on("disconnected", () => {
                this.browser = null;
            });
        }
        return this.browser;
    }

    public async getPage(): Promise<Page> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setViewport({ width: 1366, height: 768 });
        return page;
    }

    public async close() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const browserEngine = BrowserEngine.getInstance();
