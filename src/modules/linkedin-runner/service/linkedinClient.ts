import puppeteer, { Browser, Page } from "puppeteer";

export const linkedinClient = {
    async launch() {
        return puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
    },

    async openProfile(browser: Browser, url: string) {
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });
        return page;
    },

    async sendConnectionRequest(page: Page, note?: string) {
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

    async scrapeProfile(page: Page) {
        const name = await page.$eval("h1", (el: HTMLElement) => el.textContent || "");
        return { name };
    },
};
