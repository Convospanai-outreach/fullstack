import { test, expect } from '@playwright/test';

test.describe('Waitlist Flow', () => {
    test('should submit a waitlist request without creating a public account', async ({ page }) => {
        await page.goto('/signup');

        await expect(page.getByRole('heading', { name: /join the waiting list/i })).toBeVisible();
        await page.fill('input[name="name"]', 'Test User');
        await page.fill('input[name="email"]', `waitlist_${Date.now()}@example.com`);
        await page.fill('input[name="companyName"]', 'Example Services');
        await page.fill('textarea[name="useCase"]', 'Need Gmail-based drip campaign approval workflows.');

        await page.click('button[type="submit"]');

        await expect(page.getByText(/thank you\. your request has been received/i)).toBeVisible();
        await expect(page).toHaveURL(/\/signup/);
    });

    test('should validate required waitlist fields', async ({ page }) => {
        await page.goto('/signup');

        await page.click('button[type="submit"]');

        await expect(page.locator('input[name="name"]')).toBeFocused();
    });

    test('should keep invite-only login messaging visible', async ({ page }) => {
        await page.goto('/login');

        await expect(page.getByText(/access is invite-only/i)).toBeVisible();
        await expect(page.getByRole('link', { name: /join the waiting list/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /^sign in$/i })).toBeVisible();
    });
});
