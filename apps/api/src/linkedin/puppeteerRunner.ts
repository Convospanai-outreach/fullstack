import { browserManager } from "@/modules/scraper-bridge/service/browserManager";
import { logger } from "@/lib/logger";
import { gotoPublicUrl } from "@/modules/scraper-bridge/service/safeNavigation";
import { canonicalLinkedInProfileUrl } from "@/lib/crm/linkedin";

export interface LinkedInActionResult {
    ok: boolean;
    text?: string;
    data?: unknown;
    error?: string;
    action?: string;
}

export async function runPuppeteer() {
    return await browserManager.getBrowser();
}

export async function runLinkedInAction(params: any): Promise<LinkedInActionResult> {
    const { action, loginToken } = params;
    // Lead.linkedIn is free text, so only a real profile URL is opened, in its canonical linkedin.com form.
    const profileUrl = canonicalLinkedInProfileUrl(params.profileUrl);
    if (!profileUrl) {
        logger.warn(`[LinkedInRunner] ${action} skipped: not a LinkedIn profile URL`);
        return { ok: false, action, error: "Not a LinkedIn profile URL" };
    }
    logger.info(`[LinkedInRunner] Executing ${action} on ${profileUrl}`);

    const page = await browserManager.getPage();
    try {
        // Here we would typically handle authentication via loginToken if provided
        // or cookies from the session. For now, we'll navigate.
        await gotoPublicUrl(page, profileUrl, { waitUntil: 'networkidle2' });

        if (action === 'scrape') {
            const data = await page.evaluate(() => {
                return {
                    name: document.querySelector('.text-heading-xlarge')?.textContent?.trim(),
                    headline: document.querySelector('.text-body-medium')?.textContent?.trim(),
                    about: document.querySelector('#about')?.nextElementSibling?.textContent?.trim(),
                };
            });
            return { ok: true, action, data };
        }

        // Implementation for other actions (LIKE_POST, CONNECT) would go here
        // usually involving extension-delegation or actual DOM clicks if running in-browser
        
        return { ok: false, error: `Action ${action} not implemented in puppeteer runner yet. Use extension for complex actions.` };
    } catch (err: any) {
        logger.error(`[LinkedInRunner] Action failed: ${err.message}`);
        return { ok: false, error: err.message };
    } finally {
        await page.close();
    }
}
