
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
    test('should redirect to login unauthenticated user', async ({ page }) => {
        await page.goto('/dashboard');
        // Expect to be redirected to signin, or at least not show dashboard content
        // Since NextAuth usually redirects to /api/auth/signin or custom login
        await expect(page.url()).toContain('api/auth/signin');
    });

    // Since we are mocking auth in E2E usually, or need a real user.
    // For this MVP, we will assume a "skip auth" mode or just check public pages if any.
    // But wait, the app is protected. 
    // We can simulate a logged-in state by setting cookies if we had a seed script, 
    // or we can test the Login UI if it exists.

    test('should show login options', async ({ page }) => {
        await page.goto('/api/auth/signin');
        await expect(page.getByText('Sign in with Google')).toBeVisible();
        await expect(page.getByText('Sign in with Email')).toBeVisible();
    });
});
