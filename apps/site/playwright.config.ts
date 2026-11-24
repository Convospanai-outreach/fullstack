import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    timeout: 120_000,
    workers: 1,
    webServer: {
        command: process.env['CI'] ? 'npm run start' : 'npm run dev',
        port: 3001,
        timeout: 180_000,
        reuseExistingServer: !process.env['CI'],
    },
    use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:3001',
    },
});
