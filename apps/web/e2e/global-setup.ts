import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto(`${baseURL}/login`);
  await page.fill('#email', process.env.E2E_USER_EMAIL || 'test@craftmyfunnel.com');
  await page.fill('#password', process.env.E2E_USER_PASSWORD || 'testpassword');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  
  // Save auth state
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
}

export default globalSetup;
