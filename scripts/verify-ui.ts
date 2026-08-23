
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Force set HOME to USERPROFILE if missing
if (!process.env.HOME && process.env.USERPROFILE) {
    process.env.HOME = process.env.USERPROFILE;
}

async function verify() {
    const findings: any[] = [];
    const reportPath = path.resolve('verification_report.json');

    console.log('Starting custom UI verification...');

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    const pagesToTest = [
        { url: 'http://localhost:3000/', name: 'Landing Page' },
        { url: 'http://localhost:3000/dashboard', name: 'Dashboard' },
        { url: 'http://localhost:3000/leads', name: 'Leads Page' },
        { url: 'http://localhost:3000/settings/general', name: 'Settings' }
    ];

    for (const p of pagesToTest) {
        console.log(`Checking ${p.name} (${p.url})...`);
        const pageErrors: string[] = [];

        // Listen for console errors
        page.on('console', msg => {
            if (msg.type() === 'error' || msg.type() === 'warning') {
                pageErrors.push(`[${msg.type().toUpperCase()}] ${msg.text()}`);
            }
        });

        page.on('pageerror', err => {
            pageErrors.push(`[UNCAUGHT] ${err.message}`);
        });

        try {
            await page.goto(p.url, { waitUntil: 'networkidle', timeout: 30000 });

            // Basic Content Check
            const title = await page.title();
            const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));

            // Check for critical "clerk" classes we added
            const clerkCards = await page.locator('.glass-card').count();
            const glassPanels = await page.locator('.glass-panel').count();

            findings.push({
                page: p.name,
                url: p.url,
                status: 'Loaded',
                title,
                clerkCardsFound: clerkCards,
                glassPanelsFound: glassPanels,
                errors: pageErrors,
                snippet: bodyText.replace(/\n/g, ' ')
            });

        } catch (e: any) {
            findings.push({
                page: p.name,
                url: p.url,
                status: 'Failed',
                error: e.message,
                errors: pageErrors
            });
        }
    }

    await browser.close();

    fs.writeFileSync(reportPath, JSON.stringify(findings, null, 2));
    console.log(`Verification complete. Report saved to ${reportPath}`);
}

verify().catch(console.error);
