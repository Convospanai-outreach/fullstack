
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('User Journey Map', () => {
    const screenshotDir = path.resolve(__dirname, '../audit-screenshots/journey');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    test('Visitor to Signup Journey', async ({ page }) => {
        // High timeout for dev server slowness
        test.setTimeout(120000);

        // 1. Visit Home
        console.log('Navigating to Home...');
        await page.goto('/');
        await expect(page).toHaveTitle(/.*CraftMyFunnel|Home/i);
        await page.screenshot({ path: path.join(screenshotDir, '01-home-hero.png') });

        // Scroll to bottom to capture footer/features
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        await page.waitForTimeout(1000); // Wait for potential lazy loads
        await page.screenshot({ path: path.join(screenshotDir, '02-home-footer.png') });

        // 2. Navigate to Pricing
        console.log('Navigating to Pricing...');
        const pricingLink = page.locator('a[href="/pricing"]').first();
        await expect(pricingLink).toBeVisible();
        await pricingLink.click();
        await expect(page).toHaveURL(/.*pricing/);
        await page.screenshot({ path: path.join(screenshotDir, '03-pricing.png') });

        // 3. Navigate to Signup
        console.log('Navigating to Signup...');
        // Usually a "Get Started" or "Sign Up" button
        await page.goto('/signup'); // Direct navigation to be safe
        await page.screenshot({ path: path.join(screenshotDir, '04-signup-page.png') });

        // 4. Fill Signup Form
        const uniqueEmail = `testuser_${Date.now()}@example.com`;
        console.log(`Attempting signup with ${uniqueEmail}...`);

        await page.getByPlaceholder('Alex Johnson').fill('Journey Mapper');
        await page.getByPlaceholder('you@company.com').fill(uniqueEmail);
        const passwordInput = page.getByPlaceholder('Create a strong password');
        if (await passwordInput.count()) {
            await passwordInput.fill('TestPass123!');
        }

        if (process.env.E2E_MUTATING_AUTH_TESTS === 'true') {
            await page.click('button[type="submit"]');
        }

        // 5. Verify Result
        // Check if we are redirected or see a message
        await page.waitForTimeout(5000); // Wait for processing
        await page.screenshot({ path: path.join(screenshotDir, '05-signup-result.png') });

        // 6. Attempt Dashboard Access
        console.log('Attempting Dashboard access...');
        await page.goto('/dashboard');
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(screenshotDir, '06-dashboard-attempt.png') });
    });
});
