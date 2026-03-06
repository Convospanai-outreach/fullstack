/**
 * Login Simulation Script (v2)
 * Properly handles cookies for NextAuth CSRF flow:
 * 1. GET /api/auth/csrf → extract both the csrfToken AND the Set-Cookie header
 * 2. POST /api/auth/callback/credentials with both the csrfToken body param AND the cookie
 * 3. Follow the redirect to verify authenticated access to /dashboard
 */

const BASE_URL = 'http://localhost:3000';

async function simulateLogin() {
    console.log('=== ConvoSpan Login Simulation (v2) ===\n');

    // Step 1: Check dev server
    console.log('1. Checking dev server...');
    try {
        const healthRes = await fetch(BASE_URL, { signal: AbortSignal.timeout(10000) });
        console.log(`   ✓ Server running (status: ${healthRes.status})\n`);
    } catch {
        console.error('   ✗ Dev server unreachable at', BASE_URL);
        process.exit(1);
    }

    // Step 2: Check all rewritten pages
    const pages = [
        { path: '/login', label: 'Login' },
        { path: '/about', label: 'About (rewritten)' },
        { path: '/contact', label: 'Contact (rewritten)' },
        { path: '/pricing', label: 'Pricing' },
    ];
    console.log('2. Checking all pages...');
    for (const page of pages) {
        try {
            const res = await fetch(`${BASE_URL}${page.path}`, { signal: AbortSignal.timeout(10000) });
            console.log(`   ✓ ${page.label}: ${res.status}`);
        } catch {
            console.log(`   ✗ ${page.label}: FAILED`);
        }
    }

    // Step 3: Login with proper cookie flow
    console.log('\n3. Authenticating with test user...');
    console.log('   Email:    audit_user@example.com');
    console.log('   Password: AuditPassword123!\n');

    try {
        // 3a. Get CSRF token AND session cookie
        const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, {
            signal: AbortSignal.timeout(10000)
        });
        const csrfData = await csrfRes.json();
        const csrfToken = csrfData.csrfToken;

        // Extract all cookies from the CSRF response
        const setCookies = csrfRes.headers.getSetCookie?.() || [];
        const cookieHeader = setCookies.map((c: string) => c.split(';')[0]).join('; ');

        console.log(`   ✓ CSRF token: ${csrfToken?.substring(0, 20)}...`);
        console.log(`   ✓ Cookies: ${cookieHeader.substring(0, 60)}...\n`);

        // 3b. POST credentials with the cookie
        const loginRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Cookie': cookieHeader
            },
            body: new URLSearchParams({
                email: 'audit_user@example.com',
                password: 'AuditPassword123!',
                csrfToken: csrfToken || '',
                callbackUrl: `${BASE_URL}/dashboard`,
                json: 'true'
            }),
            redirect: 'manual',
            signal: AbortSignal.timeout(15000)
        });

        console.log(`   Login response: ${loginRes.status} ${loginRes.statusText}`);

        // Collect session cookies from login response
        const loginCookies = loginRes.headers.getSetCookie?.() || [];
        const sessionCookies = loginCookies.map((c: string) => c.split(';')[0]).join('; ');

        if (loginRes.status === 200) {
            const body = await loginRes.text();
            try {
                const data = JSON.parse(body);
                if (data.url && data.url.includes('dashboard')) {
                    console.log('   ✓ LOGIN SUCCESSFUL — redirecting to dashboard');
                } else if (data.url && data.url.includes('error')) {
                    console.log('   ✗ LOGIN FAILED — credentials rejected');
                    console.log(`     Redirect: ${data.url}`);
                } else if (data.url && data.url.includes('csrf=true')) {
                    console.log('   ⚠ CSRF token mismatch (cookie not accepted via fetch)');
                    console.log('     This is a known limitation of server-side fetch — NextAuth');
                    console.log('     requires browser-like cookie handling.');
                } else {
                    console.log(`   Response: ${body.substring(0, 200)}`);
                }
            } catch {
                console.log(`   Body: ${body.substring(0, 200)}`);
            }
        } else if (loginRes.status === 302 || loginRes.status === 301) {
            const location = loginRes.headers.get('location');
            if (location?.includes('dashboard')) {
                console.log('   ✓ LOGIN SUCCESSFUL — redirected to dashboard');
            } else if (location?.includes('error')) {
                console.log('   ✗ LOGIN FAILED — redirected to error');
                console.log(`     Location: ${location}`);
            } else {
                console.log(`   Redirect → ${location}`);
            }
        }

        // 3c. Try accessing a protected page with session cookies
        console.log('\n4. Testing authenticated access to /dashboard...');
        const allCookies = [cookieHeader, sessionCookies].filter(Boolean).join('; ');
        const dashRes = await fetch(`${BASE_URL}/dashboard`, {
            headers: { 'Cookie': allCookies },
            redirect: 'manual',
            signal: AbortSignal.timeout(10000)
        });

        if (dashRes.status === 200) {
            console.log('   ✓ Dashboard accessible (200) — session is valid!');
        } else if (dashRes.status === 302 || dashRes.status === 307) {
            const loc = dashRes.headers.get('location');
            console.log(`   ⚠ Redirected (${dashRes.status}) → ${loc}`);
            if (loc?.includes('login')) {
                console.log('     Session not established — login may have failed silently');
            }
        } else {
            console.log(`   Dashboard response: ${dashRes.status}`);
        }

    } catch (err) {
        console.error('   ✗ Login flow error:', (err as Error).message);
    }

    // Step 5: Check API health
    console.log('\n5. Testing API endpoints...');
    const apiEndpoints = [
        '/api/auth/session',
        '/api/auth/providers',
    ];
    for (const ep of apiEndpoints) {
        try {
            const res = await fetch(`${BASE_URL}${ep}`, { signal: AbortSignal.timeout(10000) });
            const data = await res.json();
            const summary = JSON.stringify(data).substring(0, 100);
            console.log(`   ✓ ${ep}: ${res.status} — ${summary}`);
        } catch {
            console.log(`   ✗ ${ep}: FAILED`);
        }
    }

    console.log('\n=== Simulation Complete ===\n');
    console.log('To test login in a real browser, visit: http://localhost:3000/login');
    console.log('Credentials: audit_user@example.com / AuditPassword123!');
}

simulateLogin().catch(console.error);
