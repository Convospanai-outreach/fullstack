import { browserManager } from "@/modules/scraper-bridge";
import { executeWithBackoff } from "@/lib/api-resilience";
import { v4 as uuidv4 } from "uuid";

class LinkedInRunnerService {
    async runAutomation(input: { profileUrl: string; action: string }) {
        if (!input.profileUrl) throw new Error("Missing profile URL");
        if (!input.action) throw new Error("Missing action");

        const pageId = uuidv4();

        try {
            // Use shared browser manager
            const page = await browserManager.newPage(pageId);

            // Navigate to profile
            // Navigate to profile with backoff
            await executeWithBackoff(() => page.goto(input.profileUrl, { waitUntil: "networkidle2" }));

            let result;

            switch (input.action) {
                case "connect":
                    // Mock connection logic for now
                    // In real implementation, click connect button
                    console.log(`Connecting to ${input.profileUrl}`);
                    result = { connected: true };
                    break;

                case "scrape":
                    // Mock scrape logic or use adapter
                    // In real implementation, extract data
                    console.log(`Scraping ${input.profileUrl}`);
                    const title = await page.title();
                    result = { title, scraped: true };
                    break;

                default:
                    throw new Error("Unknown action");
            }

            await browserManager.closePage(pageId);
            return { result };
        } catch (error) {
            await browserManager.closePage(pageId);
            throw error;
        }
    }
}

export const linkedinRunnerService = new LinkedInRunnerService();
