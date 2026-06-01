import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const email = process.env.TEST_USER_EMAIL || process.env.E2E_USER_EMAIL || 'audit_user@example.com';
  const password = process.env.TEST_USER_PASSWORD || process.env.E2E_USER_PASSWORD || 'AuditPassword123!';
  
  await page.goto(`${baseURL}/login`);
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.click('#login-submit');
  await page.waitForURL('**/dashboard');
  
  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}

export default globalSetup;
