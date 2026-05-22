
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should redirect to login unauthenticated user', async ({ page }) => {
        await page.goto('/dashboard');
        // Expect to be redirected to the custom login page.
        await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
    });

    // Since we are mocking auth in E2E usually, or need a real user.
    // For this MVP, we will assume a "skip auth" mode or just check public pages if any.
    // But wait, the app is protected. 
    // We can simulate a logged-in state by setting cookies if we had a seed script, 
    // or we can test the Login UI if it exists.

    test('should show login options', async ({ page }) => {
        await page.goto('/login');
        await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    });
});
