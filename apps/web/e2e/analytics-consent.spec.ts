import { test, expect, type Page } from '@playwright/test';

const GA_HOSTS = /google-analytics\.com|googletagmanager\.com/;

test.describe('Analytics consent', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    // Stub Google endpoints so the test never reaches them, while still counting every attempt.
    // The stubbed gtag.js never runs, so this checks the load attempt, not g/collect or _ga cookies.
    async function trackGoogleRequests(page: Page) {
        const urls: string[] = [];
        await page.route(GA_HOSTS, async (route) => {
            urls.push(route.request().url());
            await route.fulfill({ status: 204, body: '' });
        });
        return urls;
    }

    const gaCookies = async (page: Page) =>
        (await page.context().cookies()).map((c) => c.name).filter((name) => /^_ga|^_gid/.test(name));

    test('sends nothing to Google before a choice and after Reject', async ({ page }) => {
        const googleRequests = await trackGoogleRequests(page);

        await page.goto('/');
        await expect(page.getByRole('dialog', { name: /Analytics cookie preferences/i })).toBeVisible();
        await page.waitForTimeout(1500);
        expect(googleRequests).toEqual([]);
        expect(await gaCookies(page)).toEqual([]);

        await page.getByRole('button', { name: 'Reject' }).click();
        await page.goto('/pricing');
        await page.waitForTimeout(1500);
        expect(googleRequests).toEqual([]);
        expect(await gaCookies(page)).toEqual([]);
        await expect(page.getByRole('dialog', { name: /Analytics cookie preferences/i })).toBeHidden();
    });

    test('loads Google only after Accept and clears cookies on withdrawal', async ({ page }) => {
        const googleRequests = await trackGoogleRequests(page);

        await page.goto('/');
        await page.getByRole('button', { name: 'Accept' }).click();
        await expect.poll(() => googleRequests.some((url) => /googletagmanager\.com\/gtag\/js/.test(url))).toBe(true);

        await page.getByRole('button', { name: 'Cookie settings' }).click();
        await page.getByRole('button', { name: 'Reject' }).click();
        await expect.poll(() => gaCookies(page)).toEqual([]);

        const afterWithdrawal = googleRequests.length;
        await page.goto('/contact');
        await page.waitForTimeout(1500);
        expect(googleRequests.length).toBe(afterWithdrawal);
    });
});
