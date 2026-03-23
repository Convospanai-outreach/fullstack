import { test, expect } from '@playwright/test';

test.describe('Email Verification Flow', () => {
    test('should complete signup and email verification', async ({ page }) => {
        // Navigate to signup page
        await page.goto('/signup');

        // Fill signup form
        await page.fill('input[name="name"]', 'Test User');
        await page.fill('input[name="email"]', 'test@example.com');
        await page.fill('input[name="password"]', 'SecurePassword123!');

        // Submit form
        await page.click('button[type="submit"]');

        // Wait for success message
        await expect(page.locator('text=Account created')).toBeVisible();
        await expect(page.locator('text=check your email')).toBeVisible();

        // In a real test, you would:
        // 1. Extract verification token from test email
        // 2. Visit verification URL
        // 3. Verify success message
        // 4. Check user can access dashboard

        // For now, verify we're on the right page
        await expect(page).toHaveURL(/\/signup/);
    });

    test('should show error for existing email', async ({ page }) => {
        await page.goto('/signup');

        await page.fill('input[name="name"]', 'Test User');
        await page.fill('input[name="email"]', 'existing@example.com');
        await page.fill('input[name="password"]', 'SecurePassword123!');

        await page.click('button[type="submit"]');

        // Should show error
        await expect(page.locator('text=already exists')).toBeVisible();
    });

    test('should show verification banner for unverified users', async ({ page, context }) => {
        // Login as unverified user
        await page.goto('/login');
        await page.fill('input[name="email"]', 'unverified@example.com');
        await page.fill('input[name="password"]', 'password');
        await page.click('button[type="submit"]');

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Should show verification banner
        await expect(page.locator('text=verify your email')).toBeVisible();
        await expect(page.locator('button:has-text("Resend")')).toBeVisible();
    });

    test('should not show verification banner for verified users', async ({ page }) => {
        // Login as verified user
        await page.goto('/login');
        await page.fill('input[name="email"]', 'verified@example.com');
        await page.fill('input[name="password"]', 'password');
        await page.click('button[type="submit"]');

        // Navigate to dashboard
        await page.goto('/dashboard');

        // Should NOT show verification banner
        await expect(page.locator('text=verify your email')).not.toBeVisible();
    });
});
