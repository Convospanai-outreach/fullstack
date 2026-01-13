
import { Page } from "puppeteer";

export class Humanizer {

    /**
     * Pauses execution for a random duration between min and max seconds.
     */
    static async randomDelay(minSeconds: number = 1, maxSeconds: number = 3): Promise<void> {
        const ms = Math.floor(Math.random() * (maxSeconds - minSeconds + 1) * 1000) + minSeconds * 1000;
        await new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Simulates human-like typing with variable keystroke delays.
     */
    static async typeHuman(page: Page | any, selector: string, text: string): Promise<void> {
        const element = await page.$(selector);
        if (!element) throw new Error(`Selector not found: ${selector}`);

        await element.click();
        await this.randomDelay(0.5, 1);

        for (const char of text) {
            await page.keyboard.type(char, { delay: Math.random() * 100 + 30 }); // 30-130ms delay per key

            // Occasional long pause (simulating thinking)
            if (Math.random() < 0.05) {
                await this.randomDelay(0.3, 0.8);
            }
        }
    }

    /**
     * Simulates reading behavior by scrolling and pausing.
     */
    static async simulateReading(page: Page | any): Promise<void> {
        // Scroll down a bit
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 0.4);
        });
        await this.randomDelay(1, 3);

        // Scroll a bit more
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight * 0.3);
        });
        await this.randomDelay(2, 4);

        // Scroll back up slightly
        await page.evaluate(() => {
            window.scrollBy(0, -window.innerHeight * 0.2);
        });
        await this.randomDelay(0.5, 1.5);
    }
}
