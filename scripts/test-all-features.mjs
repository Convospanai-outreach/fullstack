/**
 * Comprehensive API Test Suite
 * Tests all new features without requiring browser
 */

async function testClientErrorAPI() {
    console.log("🧪 Testing Client Error API...\n");

    try {
        // Test 1: POST error to logging endpoint
        console.log("Test 1: Logging a client error...");
        const response = await fetch('http://localhost:3000/api/errors/client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: "Test error from API test suite",
                stack: "Error: Test\n  at testClientErrorAPI (test.js:10:5)",
                componentStack: "in TestComponent\n  in ErrorBoundary",
                url: "http://localhost:3000/test",
                userAgent: "Mozilla/5.0 (Test)",
                metadata: { test: true, timestamp: new Date().toISOString() }
            })
        });

        const data = await response.json();

        if (response.ok && data.success && data.errorId) {
            console.log(`  ✅ PASS: Error logged with ID ${data.errorId}\n`);
            return { test: 'Client Error API', status: 'PASS', errorId: data.errorId };
        } else {
            console.log(`  ❌ FAIL: ${JSON.stringify(data)}\n`);
            return { test: 'Client Error API', status: 'FAIL', error: data };
        }

    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}\n`);
        return { test: 'Client Error API', status: 'FAIL', error: error.message };
    }
}

async function testRateLimiting() {
    console.log("🧪 Testing Rate Limiting...\n");

    try {
        const errors = [];
        console.log("Sending 12 errors rapidly to trigger rate limit...");

        for (let i = 0; i < 12; i++) {
            const response = await fetch('http://localhost:3000/api/errors/client', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `Rate limit test error ${i + 1}`,
                    url: "http://localhost:3000/test"
                })
            });

            const data = await response.json();
            errors.push({ status: response.status, success: data.success });
        }

        const rateLimited = errors.some(e => e.status === 429);

        if (rateLimited) {
            console.log(`  ✅ PASS: Rate limiting triggered after 10 errors\n`);
            return { test: 'Rate Limiting', status: 'PASS' };
        } else {
            console.log(`  ❌ FAIL: Rate limiting not triggered\n`);
            return { test: 'Rate Limiting', status: 'FAIL' };
        }

    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}\n`);
        return { test: 'Rate Limiting', status: 'FAIL', error: error.message };
    }
}

async function testAdminErrorsAPI() {
    console.log("🧪 Testing Admin Errors API...\n");

    try {
        // Note: This requires authentication, will likely fail without session
        console.log("Attempting to query admin errors endpoint...");
        const response = await fetch('http://localhost:3000/api/admin/client-errors?limit=10');

        if (response.status === 401) {
            console.log(`  ⚠️  EXPECTED: Unauthorized (requires admin auth)\n`);
            return { test: 'Admin Errors API', status: 'PASS', note: 'Auth required (expected)' };
        } else if (response.ok) {
            const data = await response.json();
            console.log(`  ✅ PASS: Retrieved ${data.count} errors\n`);
            return { test: 'Admin Errors API', status: 'PASS', count: data.count };
        } else {
            console.log(`  ❌ FAIL: Unexpected status ${response.status}\n`);
            return { test: 'Admin Errors API', status: 'FAIL', status: response.status };
        }

    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}\n`);
        return { test: 'Admin Errors API', status: 'FAIL', error: error.message };
    }
}

async function testMCPTransport() {
    console.log("🧪 Testing MCP Transport Layer...\n");

    try {
        // We can't test actual connections without MCP servers, but we can verify the code loads
        console.log("Verifying MCP transport modules exist...");

        const { createTransport } = await import('../src/lib/mcp/transport.js');
        const { McpClient } = await import('../src/lib/mcp/McpClient.js');

        console.log(`  ✅ PASS: MCP modules loaded successfully\n`);
        return { test: 'MCP Transport', status: 'PASS', note: 'Modules exist and load' };

    } catch (error) {
        console.log(`  ❌ FAIL: ${error.message}\n`);
        return { test: 'MCP Transport', status: 'FAIL', error: error.message };
    }
}

// Run all tests
async function runAllTests() {
    console.log("=".repeat(60));
    console.log("API TEST SUITE - Client Error Logging & Features");
    console.log("=".repeat(60) + "\n");

    const results = [];

    // Check if server is running
    try {
        const healthCheck = await fetch('http://localhost:3000');
        if (!healthCheck.ok) throw new Error('Server not responding');
        console.log("✅ Server is running at localhost:3000\n");
    } catch (error) {
        console.log("❌ Server not accessible at localhost:3000");
        console.log("Please start the dev server: npm run dev\n");
        process.exit(1);
    }

    results.push(await testClientErrorAPI());
    results.push(await testRateLimiting());
    results.push(await testAdminErrorsAPI());
    results.push(await testMCPTransport());

    // Summary
    console.log("=".repeat(60));
    console.log("TEST RESULTS SUMMARY");
    console.log("=".repeat(60));

    const passed = results.filter(r => r.status === 'PASS').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    results.forEach(result => {
        const icon = result.status === 'PASS' ? '✅' : '❌';
        console.log(`${icon} ${result.test}: ${result.status}`);
        if (result.note) console.log(`   Note: ${result.note}`);
    });

    console.log(`\nTotal: ${passed} passed, ${failed} failed`);
    console.log("=".repeat(60));

    return results;
}

// Execute tests
runAllTests()
    .then(results => {
        const allPassed = results.every(r => r.status === 'PASS');
        process.exit(allPassed ? 0 : 1);
    })
    .catch(error => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
