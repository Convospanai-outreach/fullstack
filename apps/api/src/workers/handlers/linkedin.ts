import { BrowserEngine } from "@/lib/browser-engine";
import { logger } from "@/lib/logger";

type Page = any;

interface LinkedInPayload {
    action: "LOGIN" | "VISIT_PROFILE" | "CONNECT" | "SCRAPE_INBOX";
    cookies?: any[]; // For now, we pass cookies directly. Real app might store in DB.
    profileUrl?: string;
    message?: string;
}

export async function handleLinkedInAction(payload: LinkedInPayload) {
    const engine = BrowserEngine.getInstance();
    let page: Page | null = null;
    let result: any = {};

    try {
        page = await engine.getPage();

        // 1. Authenticate
        if (payload.cookies) {
            await page.setCookie(...payload.cookies);
        } else {
            // Fallback: Check if we are already logged in via persistent context or error out
            throw new Error("No cookies provided for LinkedIn authentication");
        }

        // 2. Perform Action
        switch (payload.action) {
            case "LOGIN":
                await page.goto("https://www.linkedin.com/feed/", { waitUntil: "networkidle2" });
                const isLoggedIn = await page.$("input[role='combobox']"); // Search bar usually indicates login
                result = { status: isLoggedIn ? "success" : "failed" };
                break;

            case "VISIT_PROFILE":
                if (!payload.profileUrl) throw new Error("Profile URL required");
                await page.goto(payload.profileUrl, { waitUntil: "networkidle2" });

                // Robust waiting instead of manual timeout
                try {
                    await page.waitForSelector("h1", { timeout: 10000 });
                } catch (e) {
                    logger.warn(`Timeout waiting for profile name on ${payload.profileUrl}`);
                }

                // Basic scraping
                const name = await page.$eval("h1", (el: HTMLElement) => el.textContent?.trim() || "Unknown");
                const description = await page.$eval(".text-body-medium.break-words", (el: HTMLElement) => el.textContent?.trim() || "").catch(() => "");

                result = { name, description, url: payload.profileUrl };
                break;

            case "CONNECT":
                if (!payload.profileUrl) throw new Error("Profile URL required");
                await page.goto(payload.profileUrl, { waitUntil: "domcontentloaded" });

                // Attempt to find and click "Connect"
                const connected = await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const connectBtn = buttons.find(b => b.innerText && b.innerText.trim() === 'Connect');
                    if (connectBtn) {
                        connectBtn.click();
                        return true;
                    }
                    return false;
                });

                if (!connected) {
                    // Ideally check "More" dropdown, but for now reporting fail is better than silent log
                    throw new Error("Connect button not found (might be already connected or behind 'More' menu)");
                }

                // Handle "Add a note" modal
                if (payload.message) {
                    try {
                        await page.waitForSelector("button[aria-label='Add a note']", { timeout: 3000 });
                        await page.click("button[aria-label='Add a note']");
                        await page.type("textarea[name='message']", payload.message);
                        await page.click("button[aria-label='Send now']");
                    } catch (e) {
                        console.warn("Could not add note, sending without if possible", e);
                        // If 'Send now' is available directly?
                        const sendBtn = await page.$("button[aria-label='Send now']");
                        if (sendBtn) await sendBtn.click();
                    }
                } else {
                    // Click "Send now" or "Send" if it appears immediately
                    try {
                        await page.waitForSelector("button[aria-label='Send now']", { timeout: 3000 });
                        await page.click("button[aria-label='Send now']");
                    } catch (e) {
                        // Might be "Send without note"
                        const sendWithoutNote = await page.$("button[aria-label='Send without note']");
                        if (sendWithoutNote) await sendWithoutNote.click();
                    }
                }

                result = { status: "sent", message: payload.message };
                break;

            default:
                throw new Error("Unsupported LinkedIn action");
        }

        return result;

    } catch (error: any) {
        console.error("LinkedIn Action Error:", error);
        throw error;
    } finally {
        if (page) await page.close();
    }
}
