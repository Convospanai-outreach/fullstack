import { test, expect } from '@playwright/test';

test.describe('Production Readiness Audit', () => {

    test('Health Check: /api/health should be reachable and UP', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toBe('UP');
    });

    test('Observability: /api/metrics should expose Prometheus data', async ({ request }) => {
        const response = await request.get('/api/metrics');
        expect(response.status()).toBe(200);
        const text = await response.text();
        expect(text).toContain('# HELP');
        expect(text).toContain('micro_llm_requests_total');
    });

    test('Security: Headers should be hardened', async ({ request }) => {
        const response = await request.get('/');
        const headers = response.headers();

        // Anti-clickjacking
        expect(headers['x-frame-options']).toBeDefined();
        // XSS Protection
        expect(headers['x-content-type-options']).toBe('nosniff');
        // CSP (Basic check)
        expect(headers['content-security-policy']).toBeDefined();
    });

    test('Distributed Tracing: Response should contain x-correlation-id', async ({ request }) => {
        const response = await request.get('/api/health');
        const headers = response.headers();
        expect(headers['x-correlation-id']).toBeDefined();
        // Confirm it looks like a UUID
        expect(headers['x-correlation-id']).toMatch(/^[0-9a-f-]{36}$/i);
    });

    test('CORS: API should allow preflight for allowed origins', async ({ request }) => {
        const response = await request.fetch('/api/health', {
            method: 'OPTIONS',
            headers: {
                'Origin': 'http://localhost:3000',
                'Access-Control-Request-Method': 'GET'
            }
        });
        expect(response.status()).toBe(200);
        expect(response.headers()['access-control-allow-origin']).toBe('http://localhost:3000');
    });
});
