
import { test, expect } from '@playwright/test';

test.describe('Error Handling', () => {
    test('should catch manual crash and show error UI', async ({ page }) => {
        test.skip(process.env.ENABLE_CRASH_E2E !== 'true', 'Crash boundary test requires enabling the protected /test-crash route.');
        // Increase timeout for this test as crash simulation might be slow in dev
        test.setTimeout(60000);

        // 1. Go to crash test page
        await page.goto('/test-crash');
        await page.waitForLoadState('domcontentloaded');

        // 1. Go to crash test page
        await page.goto('/test-crash');
        await page.waitForLoadState('domcontentloaded');

        // 2. Trigger crash
        const button = page.getByRole('button', { name: 'Trigger Crash' });
        await expect(button).toBeVisible({ timeout: 60000 });
        await button.click();

        // 3. Expect Error Boundary UI
        await expect(page.getByText('Something went wrong!')).toBeVisible();
        await expect(page.getByText('This is a manually triggered crash')).toBeVisible();

        // 4. Test Recovery
        await page.getByRole('button', { name: 'Try again' }).click();

        // 5. Should be back to test page
        await expect(page.getByText('Error Boundary Test')).toBeVisible();
    });
});
