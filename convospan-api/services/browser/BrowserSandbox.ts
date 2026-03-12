
import { Browser, LaunchOptions } from "puppeteer";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

export interface SandboxConfig {
    maxMemory?: number;
    sessionTimeout?: number;
    enableSandbox?: boolean;
}

export class BrowserSandbox {
    static async launch(config: SandboxConfig): Promise<Browser> {
        const launchOptions: any = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                `--max-old-space-size=${config.maxMemory || 512}`
            ]
        };

        return await puppeteer.launch(launchOptions);
    }
}
