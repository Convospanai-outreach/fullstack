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

    async sendConnectionRequest(_page: Page) {
        // placeholder logic – user can replace with scraper-bridge
        return { message: "Connection request simulated" };
    },

    async scrapeProfile(page: Page) {
        const name = await page.$eval("h1", (el: HTMLElement) => el.textContent || "");
        return { name };
    },
};
