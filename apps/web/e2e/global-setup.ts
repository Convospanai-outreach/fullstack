import { chromium, FullConfig } from '@playwright/test';
import { encode } from 'next-auth/jwt';
import { prisma } from '../src/lib/db';

// There is no headless way to complete a real Google OAuth consent screen in
// CI, so this seeds a test user/team directly in the DB and mints a NextAuth
// session token with the same secret the app verifies against - equivalent
// to what a completed Google sign-in would produce, without a browser ever
// touching accounts.google.com.
async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  const secret = process.env.NEXTAUTH_SECRET || 'mock-nextauth-secret-for-playwright-32chars';
  const email = (process.env.TEST_USER_EMAIL || process.env.E2E_USER_EMAIL || 'e2e-test-user@example-test.invalid').toLowerCase();
  const name = 'E2E Test User';

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: { email, name, emailVerified: new Date(), settings: { create: { theme: 'dark' } } },
    });
  }

  const membership = await prisma.teamMember.findFirst({ where: { userId: user.id, status: 'active' } });
  if (!membership) {
    await prisma.team.create({
      data: {
        name: `${name}'s Team`,
        members: { create: { userId: user.id, email, role: 'owner', status: 'active' } },
      },
    });
  }

  const sessionToken = await encode({
    secret,
    token: {
      id: user.id,
      sub: user.id,
      email: user.email,
      name: user.name,
      picture: null,
      plan: 'free',
      productMode: 'ENTERPRISE_CORE',
      productSurface: 'outreach',
      enterpriseRole: user.enterpriseRole || 'SALES_USER',
      claimsRefreshedAt: Date.now(),
    },
  });

  const url = new URL(baseURL || 'http://localhost:3000');
  const isSecure = url.protocol === 'https:';
  const cookieName = isSecure ? '__Secure-next-auth.session-token' : 'next-auth.session-token';

  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addCookies([{
    name: cookieName,
    value: sessionToken,
    domain: url.hostname,
    path: '/',
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
  }]);

  const page = await context.newPage();
  await page.goto(`${baseURL}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 60000 });

  await context.storageState({ path: 'e2e/.auth/user.json' });
  await browser.close();
  await prisma.$disconnect();
}

export default globalSetup;
