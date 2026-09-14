
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('should redirect to login unauthenticated user', async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/dashboard');
        // Expect to be redirected to the custom login page.
        await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
    });

    test('should show login options', async ({ page }) => {
        test.setTimeout(60000);
        await page.goto('/login');
        await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible({ timeout: 45000 });
    });
});
