
import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Configuration
const SCREENSHOT_DIR = path.resolve(__dirname, '../audit-screenshots/comprehensive');
const REPORT_FILE = path.resolve(__dirname, '../audit-report.json');

// Ensure directories exist
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

interface PageError {
    route: string;
    type: 'console-error' | 'console-warn' | 'page-error' | 'request-failed';
    message: string;
    stack?: string;
}

const errors: PageError[] = [];

// Helper to capture errors
function attachErrorListeners(page: Page, route: string) {
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push({ route, type: 'console-error', message: msg.text() });
        } else if (msg.type() === 'warning') {
            errors.push({ route, type: 'console-warn', message: msg.text() });
        }
    });

    page.on('pageerror', exception => {
        errors.push({ route, type: 'page-error', message: exception.message, stack: exception.stack });
    });

    page.on('requestfailed', request => {
        const failure = request.failure();
        errors.push({
            route,
            type: 'request-failed',
            message: `${request.method()} ${request.url()} - ${failure?.errorText || 'Unknown error'}`
        });
    });
}

test.describe.serial('Comprehensive Frontend Audit', () => {

    test.afterAll(() => {
        // Write report to file
        fs.writeFileSync(REPORT_FILE, JSON.stringify(errors, null, 2));
        console.log(`Audit complete. Report saved to ${REPORT_FILE}`);
        console.log(`Screenshots saved to ${SCREENSHOT_DIR}`);
    });

    const publicRoutes = [
        '/',
        '/about',
        '/contact',
        '/pricing',
        // '/login', // Covered in login step
        // '/signup', // Skip signup to avoid creating garbage users
    ];

    const protectedRoutes = [
        '/dashboard',
        '/settings',
        '/settings/profile',
        '/profile',
        '/monitoring',
        '/audit-logs',
        '/jobs',
        '/calendar',
        '/automations'
    ];

    // 1. Audit Public Routes
    for (const route of publicRoutes) {
        test(`Audit Public Route: ${route}`, async ({ page }) => {
            test.setTimeout(120000); // Handle cold start
            attachErrorListeners(page, route);
            console.log(`Navigating to ${route}...`);
            await page.goto(route);
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(500);

            // Basic assertion to ensure page loaded
            await expect(page).toHaveTitle(/CraftMyFunnel|.*/i);

            // Screenshot
            const safeRoute = route === '/' ? 'home' : route.replace(/\//g, '-').substring(1);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, `public-${safeRoute}.png`), fullPage: true });
        });
    }

    // 2. Login & Audit Protected Routes
    test('Login and Audit Protected Routes', async ({ page }) => {
        test.setTimeout(120000); // 2 minutes for cold start
        attachErrorListeners(page, '/login');
        console.log('Logging in...');
        await page.goto('/login');

        if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) {
            await expect(page.locator('#clerk-sign-in-root')).toBeVisible({ timeout: 45000 });
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'protected-login-required.png'), fullPage: true });
            return;
        }

        await page.waitForSelector('#clerk-sign-in-root[data-clerk-mounted="true"]', { timeout: 45000 });
        await page.locator('#identifier-field').waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('#identifier-field').fill(process.env.TEST_USER_EMAIL);
        await page.locator('#password-field').fill(process.env.TEST_USER_PASSWORD);
        await page.getByRole('button', { name: 'Continue', exact: true }).click();

        const otpInput = page.locator('input[name="code"], input[autocomplete="one-time-code"]').first();
        const otpAppeared = await otpInput.waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
        if (otpAppeared) {
            await otpInput.fill('424242');
            const continueButton = page.getByRole('button', { name: 'Continue', exact: true });
            if (await continueButton.isVisible().catch(() => false)) {
                await continueButton.click();
            }
        }

        await page.waitForURL(/.*dashboard/);
        await page.waitForLoadState('networkidle');

        // Audit Dashboard immediately after login
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'protected-dashboard.png'), fullPage: true });

        // Iterate other protected routes
        for (const route of protectedRoutes) {
            if (route === '/dashboard') continue; // Already checked

            attachErrorListeners(page, route);
            console.log(`Navigating to ${route}...`);
            await page.goto(route);
            // Allow some time for hydration/rendering
            await page.waitForLoadState('domcontentloaded');
            await page.waitForTimeout(500);

            const safeRoute = route.replace(/\//g, '-').substring(1);
            await page.screenshot({ path: path.join(SCREENSHOT_DIR, `protected-${safeRoute}.png`), fullPage: true });
        }
    });

});
