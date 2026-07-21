
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Redirect Playwright's transform cache to a writable local directory before it initializes.
// This prevents EPERM errors on Windows where C:\WINDOWS\TEMP is protected.
const cacheDir = path.resolve(__dirname, '.playwright-cache');
if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
}
process.env['PLAYWRIGHT_COMPILE_CACHE'] = cacheDir;
process.env['TEMP'] = cacheDir;
process.env['TMP'] = cacheDir;

// Dynamically require playwright AFTER setting the cache dir to avoid ES import hoisting
const { defineConfig, devices } = require('@playwright/test') as typeof import('@playwright/test');

// Read from default .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
    testDir: './e2e',
    timeout: 120_000,
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: 'html',
    webServer: {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        cwd: __dirname,
        port: 3000,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
            ...process.env,
            PORT: '3000',
            DISABLE_RATE_LIMIT: 'true',
            NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env['NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'] || 'pk_test_Y2xlcmsuY3JhZnRteWZ1bm5lbC5saXZlJA',
            CLERK_SECRET_KEY: process.env['CLERK_SECRET_KEY'] || 'sk_test_bW9jay1jbGVyay1zZWNyZXQta2V5LWZvci10ZXN0aW5nLXBsYXl3cmlnaHQ',
            NEXTAUTH_SECRET: process.env['NEXTAUTH_SECRET'] || 'mock-nextauth-secret-for-playwright-32chars',
            NEXTAUTH_URL: process.env['NEXTAUTH_URL'] || 'http://localhost:3000',
        },
    },
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
        storageState: 'e2e/.auth/user.json',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
        // {
        //   name: 'firefox',
        //   use: { ...devices['Desktop Firefox'] },
        // },
        // {
        //   name: 'webkit',
        //   use: { ...devices['Desktop Safari'] },
        // },
    ],

});
