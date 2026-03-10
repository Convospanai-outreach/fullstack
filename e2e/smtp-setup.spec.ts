import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('SMTP Setup UI', () => {
    const screenshotDir = path.resolve(__dirname, '../audit-screenshots/smtp-setup');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }

    test.use({ viewport: { width: 1280, height: 720 } });

    test('Should display and fill SMTP Setup Form', async ({ page }) => {
        test.setTimeout(120000);

        // 1. Login
        console.log('Navigating to Login...');
        await page.goto('/login');
        await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'audit_user@example.com');
        await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'AuditPassword123!');
        await page.click('button[type="submit"]');
        await page.waitForURL(/.*dashboard/);

        // 2. Go straight to Setup
        console.log('Navigating to Setup...');
        await page.goto('/setup');
        // Let it load normally
        
        // 3. Navigate to Step 3 (Email Integration)
        // We can click the step in the sidebar if it exists, or just use the text.
        // Look for the text 'Email Integration' and click it.
        const emailIntegrationStep = page.locator('text=Email Integration');
        await emailIntegrationStep.click();

        // 4. Verify SMTP form is visible
        await expect(page.locator('text=Google Business SMTP (Gmail)')).toBeVisible();

        console.log('Filling out SMTP Form...');
        // 5. Fill out the form
        await page.fill('input[title="SMTP Host"]', 'smtp.mock-test.com');
        await page.fill('input[title="SMTP Port"]', '587');
        await page.fill('input[title="Email Address"]', 'test@example.com');
        await page.fill('input[title="App Password"]', 'mockpassword123');
        await page.fill('input[title="From Name"]', 'Test Sender');
        await page.fill('input[title="From Email"]', 'test@example.com');

        // Capture screenshot of the filled form
        await page.screenshot({ path: path.join(screenshotDir, '01-smtp-form-filled.png') });

        // 6. Test the connection
        console.log('Testing Connection...');
        
        // Setup a listener to wait strictly for the dialog
        const dialogPromise = page.waitForEvent('dialog');
        await page.click('button:has-text("Test Connection")');

        // Wait for the dialog to actually appear (will wait until timeout if it doesn't)
        const dialog = await dialogPromise;
        const alertMessage = dialog.message();
        console.log(`Alert appeared: ${alertMessage}`);
        await dialog.accept();

        // Since we are creating a fake SMTP host, it will likely fail. That's fine, we just want to verify the UI interaction.
        console.log('Test completed. Alert message received:', alertMessage);
        
        // Assert we got an alert message
        expect(alertMessage).toContain('Connection');

        await page.screenshot({ path: path.join(screenshotDir, '02-smtp-form-after-test.png') });
    });
});
