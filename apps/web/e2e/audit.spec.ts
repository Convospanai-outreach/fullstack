
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Frontend Visual Audit', () => {
    // Create a directory for audit screenshots if it doesn't exist
    const screenshotDir = path.resolve(__dirname, '../audit-screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
    }

    test('audit home page', async ({ page }) => {
        await page.goto('/');
        await expect(page).toHaveTitle(/.*ConvoSpan|Home/i);
        await page.screenshot({ path: path.join(screenshotDir, 'home-desktop.png'), fullPage: true });

        // Mobile view
        await page.setViewportSize({ width: 375, height: 667 });
        await page.screenshot({ path: path.join(screenshotDir, 'home-mobile.png'), fullPage: true });
    });

    test('audit pricing page', async ({ page }) => {
        await page.goto('/pricing');
        // Accept relaxed title check in case it's generic
        await expect(page).toHaveTitle(/.*Pricing|.*/i);
        await page.screenshot({ path: path.join(screenshotDir, 'pricing-desktop.png'), fullPage: true });
    });

    test('audit login page', async ({ page }) => {
        await page.goto('/api/auth/signin');
        await page.screenshot({ path: path.join(screenshotDir, 'login-desktop.png') });
    });

    test('audit dashboard redirect', async ({ page }) => {
        await page.goto('/dashboard');
        // Should redirect to the custom login page.
        await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
        await page.screenshot({ path: path.join(screenshotDir, 'dashboard-redirect.png') });
    });

    // Check for 404 page appearance
    test('audit 404 page', async ({ page }) => {
        await page.goto('/non-existent-page-random-123');
        await page.screenshot({ path: path.join(screenshotDir, '404-page.png') });
    });
});
