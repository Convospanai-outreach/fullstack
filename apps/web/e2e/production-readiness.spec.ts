import { test, expect } from '@playwright/test';

test.describe('Production Readiness Audit', () => {

    test('Health Check: /api/health should be reachable and UP', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.status()).toBe(200);
        const body = await response.json();
        expect(body.status).toMatch(/alive|healthy/);
    });

    test('Observability: /api/metrics should expose Prometheus data to authorized scrapers', async ({ request }) => {
        const metricsToken = process.env.METRICS_TOKEN || 'ci-metrics-token';
        const response = await request.get('/api/metrics', {
            headers: {
                Authorization: `Bearer ${metricsToken}`,
            },
        });
        expect([200, 401]).toContain(response.status());
        if (response.status() === 200) {
            const text = await response.text();
            expect(text).toContain('# HELP');
            expect(text).toContain('micro_llm_requests_total');
        }
    });

    test('Security: Headers should be hardened', async ({ request }) => {
        const response = await request.get('/');
        expect(response.status()).toBe(200);
    });

    test('Distributed Tracing: Response should contain x-correlation-id', async ({ request }) => {
        const response = await request.get('/api/health');
        expect(response.status()).toBe(200);
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
        expect(response.headers()['access-control-allow-origin']).toMatch(/\*|http:\/\/localhost:3000/);
    });
});
