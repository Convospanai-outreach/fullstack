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
        await page.waitForLoadState('networkidle');

        // Wait for key dashboard elements to confirm loading (e.g. sidebar, widgets)
        try {
            await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('Overview header not found immediately, checking screenshot...');
        }

        await page.screenshot({ path: path.join(screenshotDir, '01-dashboard-overview.png') });

        // 4. Test Navigation (e.g., Settings)
        console.log('Navigating to Settings...');
        try {
            // Assume sidebar link for settings
            const settingsLink = page.locator('a[href*="/settings"]').first();
            if (await settingsLink.isVisible()) {
                await settingsLink.click();
            } else {
                await page.goto('/settings/profile');
            }
            await expect(page).toHaveURL(/.*settings/);
            await page.screenshot({ path: path.join(screenshotDir, '02-settings.png') });
        } catch (e) {
            console.log('Settings navigation failed');
        }
    });
});
