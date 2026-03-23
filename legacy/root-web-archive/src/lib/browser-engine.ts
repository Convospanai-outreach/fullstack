
/**
 * Frontend Shell for BrowserEngine.
 * 
 * This file replaces the real BrowserEngine in the frontend to avoid
 * bundling heavy dependencies (puppeteer, playwright).
 * Automation tasks should be handled by the standalone backend service.
 */
export class BrowserEngine {
    private static instance: BrowserEngine;
    public static getInstance(): BrowserEngine {
        if (!BrowserEngine.instance) BrowserEngine.instance = new BrowserEngine();
        return BrowserEngine.instance;
    }

    public async getBrowser(): Promise<any> {
        throw new Error("Browser automation must be performed on the backend service.");
    }

    public async getPage(): Promise<any> {
        throw new Error("Browser automation must be performed on the backend service.");
    }

    public async close() {}
}
