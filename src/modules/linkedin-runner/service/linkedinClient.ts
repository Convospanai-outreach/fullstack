
import puppeteer, { Browser, Page } from "puppeteer";

type ExecutionMode = 'CLOUD' | 'LOCAL';
const EXECUTION_MODE: ExecutionMode = (process.env['LINKEDIN_EXECUTION_MODE'] as ExecutionMode) || 'LOCAL'; // Default to LOCAL for safety

export const linkedinClient = {
    async launch() {
        if (EXECUTION_MODE === 'LOCAL') {
            console.log("[LinkedIn] Launching in LOCAL mode (Instructions queued for Client-Side Agent)");
            return null; // No browser needed
        }
        return puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
    },

    async openProfile(browser: Browser | null, url: string) {
        if (EXECUTION_MODE === 'LOCAL') {
            return { mode: 'LOCAL', url }; // Virtual page
        }
        if (!browser) throw new Error("Browser not initialized");
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });
        return page;
    },

    async sendConnectionRequest(page: Page | any, note?: string) {
        if (EXECUTION_MODE === 'LOCAL') {
            console.log(`[LinkedIn] Queuing LOCAL command: CONNECT ${page.url} with note: "${note || ''}"`);
            // In a real implementation, this would push to a Redis queue:
            // await commandQueue.add({ type: 'CONNECT', target: page.url, note, userId: ... });
            return {
                success: true,
                message: "Command queued for local execution",
                queued: true
            };
        }

        // CLOUD MODE (Legacy/High Risk)
        try {
            // Wait for the "Connect" button to be visible
            const connectButtonSelector = 'button[aria-label*="Connect"], button:has-text("Connect")';
            await page.waitForSelector(connectButtonSelector, { timeout: 5000 });

            // Click the Connect button
            await page.click(connectButtonSelector);

            // If a note is provided, add it
            if (note) {
                const addNoteSelector = 'button[aria-label*="Add a note"]';
                const noteExists = await page.$(addNoteSelector);

                if (noteExists) {
                    await page.click(addNoteSelector);
                    await page.waitForSelector('textarea[name="message"]', { timeout: 3000 });
                    await page.type('textarea[name="message"]', note);
                }
            }

            // Click the final "Send" button
            const sendButtonSelector = 'button[aria-label*="Send"], button:has-text("Send")';
            await page.waitForSelector(sendButtonSelector, { timeout: 3000 });
            await page.click(sendButtonSelector);

            // Wait for confirmation
            await new Promise(resolve => setTimeout(resolve, 2000));

            return {
                success: true,
                message: "Connection request sent successfully"
            };
        } catch (error) {
            console.error('[LinkedIn Client] Failed to send connection request:', error);
            return {
                success: false,
                message: error instanceof Error ? error.message : "Unknown error",
                error
            };
        }
    },

    async scrapeProfile(page: Page | any) {
        if (EXECUTION_MODE === 'LOCAL') {
            console.log(`[LinkedIn] Queuing LOCAL command: SCRAPE ${page.url}`);
            return { name: "Pending Local Execution" };
        }

        const name = await page.$eval("h1", (el: HTMLElement) => el.textContent || "");
        return { name };
    },
};
