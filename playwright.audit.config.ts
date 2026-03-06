
import { defineConfig, devices } from '@playwright/test';
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
