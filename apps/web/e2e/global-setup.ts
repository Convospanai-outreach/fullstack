import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const email = process.env.TEST_USER_EMAIL || process.env.E2E_USER_EMAIL || 'audit_user@example.com';
  const password = process.env.TEST_USER_PASSWORD || process.env.E2E_USER_PASSWORD || 'AuditPassword123!';
  
  await page.goto(`${baseURL}/login`);
  await page.waitForSelector('#clerk-sign-in-root[data-clerk-mounted="true"]', { timeout: 45000 });
  await page.locator('#identifier-field').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#identifier-field').fill(email);
  await page.locator('#password-field').fill(password);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  // Clerk dev instances challenge new devices with an email OTP step. The fixed
  // test code (424242) only auto-verifies for "+clerk_test" addresses.
  const otpInput = page.locator('input[name="code"], input[autocomplete="one-time-code"]').first();
  const otpAppeared = await otpInput.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (otpAppeared) {
    await otpInput.fill('424242');
    const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    }
  }

  await page.waitForURL('**/dashboard', { timeout: 120000, waitUntil: 'domcontentloaded' });
  
  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}

export default globalSetup;
