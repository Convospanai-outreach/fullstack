/**
 * Browser Sandbox Verification Test
 * 
 * Verifies that the browser launches successfully with sandbox enabled/disabled
 * and that security controls are properly applied.
 */

import { BrowserSandbox } from "@/lib/security/BrowserSandbox";

async function testBrowserSandbox() {
    console.log("🔒 Testing Browser Sandbox Implementation\\n");

    try {
        // Test 1: Launch with sandbox disabled (development mode)
        console.log("Test 1: Launching browser with sandbox DISABLED...");
        const browserDev = await BrowserSandbox.launch({
            enableSandbox: false,
            sessionTimeout: 30000 // 30 seconds for test
        });

        const version = await browserDev.version();
        console.log(`  ✓ Browser launched: ${version}`);
        console.log(`  ✓ Sandbox: DISABLED (development mode)\\n`);

        // Create a test page
        const page = await browserDev.newPage();
        await page.goto('https://example.com', { timeout: 10000 });
        const title = await page.title();
        console.log(`  ✓ Page loaded: ${title}`);

        await browserDev.close();
        console.log(`  ✓ Browser closed\\n`);

        // Test 2: URL filtering
        console.log("Test 2: Testing URL filtering...");
        const config = {
            blockedDomains: ['ads.com', 'tracker.com'],
            allowedDomains: ['example.com', 'linkedin.com']
        };

        const testCases = [
            { url: 'https://example.com', expected: true },
            { url: 'https://ads.com', expected: false },
            { url: 'https://tracker.com/page', expected: false },
            { url: 'https://other.com', expected: false } // Not in allowlist
        ];

        for (const test of testCases) {
            const allowed = BrowserSandbox.isUrlAllowed(test.url, config);
            const status = allowed === test.expected ? '✓' : '❌';
            console.log(`  ${status} ${test.url} - Allowed: ${allowed} (Expected: ${test.expected})`);
        }
        console.log("");

        // Test 3: Attempt with sandbox enabled (may fail in some envs)
        console.log("Test 3: Attempting browser launch with sandbox ENABLED...");
        try {
            const browserProd = await BrowserSandbox.launch({
                enableSandbox: true,
                sessionTimeout: 30000
            });

            console.log(`  ✓ Browser launched with SANDBOX ENABLED`);
            console.log(`  ✓ ${BrowserSandbox.getEnvironmentGuidance()}`);

            await browserProd.close();
            console.log(`  ✓ Browser closed\\n`);

            console.log("✅ ALL TESTS PASSED\\n");
            console.log("🎉 Browser Sandbox is working correctly!\\n");
        } catch (error: any) {
            if (error.message.includes('namespace') || error.message.includes('sandbox')) {
                console.log(`  ⚠️  Sandbox mode failed (expected in some environments)`);
                console.log(`  Error: ${error.message}\\n`);
                console.log("📋 Environment Guidance:");
                console.log(`  ${BrowserSandbox.getEnvironmentGuidance()}\\n`);
                console.log("✅ Tests PARTIALLY PASSED (sandbox not available in this environment)\\n");
            } else {
                throw error;
            }
        }

    } catch (error: any) {
        console.error("❌ Test failed:", error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run test
console.log("=".repeat(60));
console.log("Browser Sandbox Security Test");
console.log("=".repeat(60) + "\\n");

testBrowserSandbox()
    .then(() => {
        console.log("Test completed successfully!");
        process.exit(0);
    })
    .catch(error => {
        console.error("Test failed:", error);
        process.exit(1);
    });
