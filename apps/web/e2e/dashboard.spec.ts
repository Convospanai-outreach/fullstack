import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Dashboard Journey Map', () => {
    const screenshotDir = path.resolve(__dirname, '../audit-screenshots/dashboard');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    test.use({ viewport: { width: 1280, height: 720 }, storageState: 'e2e/.auth/user.json' });

    test('Authenticated Dashboard Flow', async ({ page }) => {
        test.setTimeout(120000);

        // Listen for console logs
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        // Listen for network errors (specifically auth)
        page.on('response', resp => {
            if (resp.url().includes('/api/auth') && resp.status() !== 200) {
                console.log(`[AUTH-ERROR] ${resp.status()} ${resp.url()}`);
            }
        });

        // 2. Verify Dashboard Access
        console.log('Navigating to Dashboard...');
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });
        await page.waitForLoadState('domcontentloaded');

        // Wait for the dashboard shell and primary heading instead of background network idle.
        await expect(page.getByRole('heading', { name: /guided growth workflow/i })).toBeVisible({ timeout: 15000 });

        await page.screenshot({ path: path.join(screenshotDir, '01-dashboard-overview.png') });

        // 4. Test Navigation (e.g., Settings)
        console.log('Navigating to Settings...');
        await page.goto('/settings/general');
        await expect(page).toHaveURL(/.*settings/);
        await expect(page.getByRole('heading', { name: /^general$/i })).toBeVisible({ timeout: 15000 });
        await page.screenshot({ path: path.join(screenshotDir, '02-settings.png') });
    });
});
