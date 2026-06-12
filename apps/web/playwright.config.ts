
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
        port: 3000,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
            ...process.env,
            PORT: '3000',
            DISABLE_RATE_LIMIT: 'true',
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
