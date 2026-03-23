import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

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
import dotenv from 'dotenv';
import path from 'path';

// Read from default .env file
dotenv.config({ path: path.resolve(__dirname, '.env') });

export default defineConfig({
    testDir: './e2e',
    // Run the dashboard spec
    testMatch: ['comprehensive-audit.spec.ts', 'dashboard.spec.ts'],
    fullyParallel: false,
    reporter: 'html',
    timeout: 120000,
    use: {
        baseURL: 'http://localhost:3000',
        trace: 'on-first-retry',
    },

    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 180 * 1000,
        env: {
            DISABLE_RATE_LIMIT: 'true',
        }
    },
});
