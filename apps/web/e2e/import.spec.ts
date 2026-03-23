
import { test, expect } from '@playwright/test';

test.describe('Import Flow', () => {
    test.skip('should upload a csv', async ({ page }) => {
        await page.goto('/leads/import');
        // File chooser handling
        // ...
        await expect(page.getByText('Import successful')).toBeVisible();
    });
});
