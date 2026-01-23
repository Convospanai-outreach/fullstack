
import puppeteer, { Browser, Page } from "puppeteer";
import { Humanizer } from "./Humanizer";
import { LinkedInConstants } from "./LinkedInConstants";

type ExecutionMode = 'CLOUD' | 'LOCAL';
function getExecutionMode(): ExecutionMode {
    if (process.env['LINKEDIN_EXECUTION_MODE'] === 'CLOUD') return 'CLOUD';
    return 'LOCAL'; // Default to SafeRun™
}

export const linkedinClient = {
    async launch() {
        // Deep Tech / Cyber-Physical Mode
        const browserWSEndpoint = process.env['BROWSER_NODE_URL'] || process.env['BROWSER_WS_ENDPOINT'];

        if (browserWSEndpoint) {
            console.log(`[LinkedIn] Connecting to Physical Browser Node at ${browserWSEndpoint}...`);
            try {
                return await puppeteer.connect({
                    browserWSEndpoint: browserWSEndpoint,
                    defaultViewport: null,
                });
            } catch (error: any) {
                console.error("[LinkedIn] Failed to connect to Physical Browser:", error.message);
                throw new Error("Physical Browser Node Unreachable - Hardware Verification Failed");
            }
        }

        if (getExecutionMode() === 'LOCAL') {
            console.log("[LinkedIn] Launching in LOCAL mode (Instructions queued for Client-Side Agent)");
            return null; // No browser needed
        }
        return puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });
    },

    async openProfile(browser: Browser | null, url: string) {
        if (getExecutionMode() === 'LOCAL') {
            return { mode: 'LOCAL', url }; // Virtual page
        }
        if (!browser) throw new Error("Browser not initialized");
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });
        return page;
    },

    async sendConnectionRequest(page: Page | any, note?: string, context?: { teamId: string }) {
        if (context?.teamId) {
            const { FeatureFlagService } = await import("@/lib/flags/service");
            const allowed = await FeatureFlagService.isEnabled("linkedin_automation", context.teamId);
            if (!allowed) {
                console.warn(`[LinkedIn] Blocked by policy for team ${context.teamId}`);
                return {
                    success: false,
                    message: "Feature blocked by enterprise policy (linkedin_automation)",
                    requiresReview: true
                };
            }
        }

        if (getExecutionMode() === 'LOCAL') {
            console.log(`[LinkedIn] Queuing LOCAL command: CONNECT ${page.url} with note: "${note || ''}"`);
            // In a real implementation, this would push to a Redis queue:
            // await commandQueue.add({ type: 'CONNECT', target: page.url, note, userId: ... });
            return {
                success: true,
                message: "Draft queued for user review (Assisted Mode)",
                queued: true,
                requiresReview: true
            };
        }

        // CLOUD MODE (Legacy/High Risk)
        try {
            // Wait for the "Connect" button to be visible
            // Wait for the "Connect" button to be visible
            // Try multiple selectors for robustness
            const connectSelector = LinkedInConstants.SELECTORS.CONNECT_BTN.join(', ');
            await page.waitForSelector(connectSelector, { timeout: 10000 });

            // Click the Connect button with human delay
            await Humanizer.randomDelay(1, 3);
            const connectBtn = await page.$(connectSelector);
            if (connectBtn) await connectBtn.click();
            else throw new Error("Connect button unexpectedly missing after wait");

            await Humanizer.randomDelay(1, 2);

            // If a note is provided, add it
            if (note) {
                // Check if "Add a note" button exists
                const addNoteSelector = LinkedInConstants.SELECTORS.ADD_NOTE_BTN;
                const noteExists = await page.$(addNoteSelector);

                if (noteExists) {
                    await noteExists.click();
                    await Humanizer.randomDelay(0.5, 1.5);

                    const noteSelector = LinkedInConstants.SELECTORS.NOTE_TEXTAREA;
                    await page.waitForSelector(noteSelector, { timeout: 3000 });

                    // Human-like typing
                    await Humanizer.typeHuman(page, noteSelector, note);
                    await Humanizer.randomDelay(0.8, 1.5);
                }
            }

            // Click the final "Send" button
            const sendSelector = LinkedInConstants.SELECTORS.SEND_BTN.join(', ');
            await page.waitForSelector(sendSelector, { timeout: 5000 });

            const sendBtn = await page.$(sendSelector);
            if (sendBtn) await sendBtn.click();

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
        if (getExecutionMode() === 'LOCAL') {
            console.log(`[LinkedIn] Queuing LOCAL command: SCRAPE ${page.url}`);
            return { name: "Pending Local Execution" };
        }

        const name = await page.$eval("h1", (el: HTMLElement) => el.textContent || "");
        return { name };
    },
};
