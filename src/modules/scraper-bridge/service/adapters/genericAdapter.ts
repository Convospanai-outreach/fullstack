import { Page } from "puppeteer";
import { ScraperAdapter } from "../../types/scraper.types";

class GenericAdapter implements ScraperAdapter {
    validate(_url: string): boolean {
        return true; // Accepts any URL
    }

    async scrape(url: string, page: Page, options?: any): Promise<any> {
        await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

        // Wait for custom selector if provided
        if (options?.waitForSelector) {
            await page.waitForSelector(options.waitForSelector, { timeout: 10000 });
        }

        // Extract data based on provided fields
        const data: any = {};

        if (options?.extractFields) {
            for (const field of options.extractFields) {
                try {
                    const value = await page.$eval(field, (el) => el.textContent?.trim() || "");
                    data[field] = value;
                } catch (e) {
                    data[field] = null;
                }
            }
        } else {
            // Default: extract title and meta description
            data.title = await page.title();
            data.description = await page.$eval(
                'meta[name="description"]',
                (el) => el.getAttribute("content") || ""
            ).catch(() => "");
        }

        return data;
    }
}

export const genericAdapter = new GenericAdapter();
