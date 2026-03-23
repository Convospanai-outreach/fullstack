
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Dashboard Journey Map', () => {
    const screenshotDir = path.resolve(__dirname, '../audit-screenshots/dashboard');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    test.use({ viewport: { width: 1280, height: 720 } });

    test('Authenticated Dashboard Flow', async ({ page }) => {
        test.setTimeout(120000);

        // 1. Login
        console.log('Navigating to Login...');
        await page.goto('/login'); // or /api/auth/signin if NextAuth default

        // Listen for console logs
        page.on('console', msg => console.log(`[BROWSER] ${msg.text()}`));
        // Listen for network errors (specifically auth)
        page.on('response', resp => {
            if (resp.url().includes('/api/auth') && resp.status() !== 200) {
                console.log(`[AUTH-ERROR] ${resp.status()} ${resp.url()}`);
            }
        });

        console.log('Filling Credentials...');
        await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'audit_user@example.com');
        await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'AuditPassword123!');

        // Wait for potential submit button
        const submitBtn = page.locator('button[type="submit"]');
        await expect(submitBtn).toBeVisible();
        await submitBtn.click();

        // 2. Verify Dashboard Access
        console.log('Waiting for Dashboard...');
        await expect(page).toHaveURL(/.*dashboard/, { timeout: 30000 });
        await page.waitForLoadState('networkidle');

        // Wait for key dashboard elements to confirm loading (e.g. sidebar, widgets)
        // Adjust these selectors based on your actual dashboard components
        try {
            await expect(page.locator('text=Overview')).toBeVisible({ timeout: 10000 });
        } catch (e) {
            console.log('Overview header not found immediately, checking screenshot...');
        }

        await page.screenshot({ path: path.join(screenshotDir, '01-dashboard-overview.png') });

        // 3. Map Widgets (if identifiable)
        // Just general screenshot for now

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
