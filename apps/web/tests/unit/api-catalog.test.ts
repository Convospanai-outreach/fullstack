import { describe, expect, it } from 'vitest';
import { getApiCatalogDocument, getApiCatalogJson } from '../../src/lib/apiCatalog';
import { GET as getApiCatalogRoute } from '../../src/app/.well-known/api-catalog/route';
import { GET as getOpenApiRoute } from '../../src/app/api/openapi.json/route';

function createMockRequest(url: string) {
    const parsed = new URL(url);
    return {
        headers: new Headers(),
        nextUrl: {
            pathname: parsed.pathname,
            origin: parsed.origin,
        },
    } as any;
}

describe('RFC 9727 API Catalog Discovery (/.well-known/api-catalog)', () => {
    describe('getApiCatalogDocument', () => {
        it('returns a valid RFC 9727 linkset document with required relations', () => {
            const doc = getApiCatalogDocument('https://craftmyfunnel.live');
            expect(doc.linkset).toBeDefined();
            expect(Array.isArray(doc.linkset)).toBe(true);
            expect(doc.linkset.length).toBeGreaterThanOrEqual(1);

            const primaryApi = doc.linkset[0];
            expect(primaryApi.anchor).toBe('https://craftmyfunnel.live/api');

            // service-desc (OpenAPI spec)
            expect(primaryApi['service-desc']).toBeDefined();
            expect(primaryApi['service-desc'][0].href).toBe('https://craftmyfunnel.live/api/openapi.json');
            expect(primaryApi['service-desc'][0].type).toBe('application/json');

            // service-doc (Documentation)
            expect(primaryApi['service-doc']).toBeDefined();
            expect(primaryApi['service-doc'][0].type).toBe('text/html');

            // status (Health probe)
            expect(primaryApi.status).toBeDefined();
            expect(primaryApi.status?.[0].href).toBe('https://craftmyfunnel.live/api/health');
            expect(primaryApi.status?.[0].type).toBe('application/json');
        });

        it('produces valid JSON matching getApiCatalogJson', () => {
            const jsonStr = getApiCatalogJson('https://craftmyfunnel.live');
            const parsed = JSON.parse(jsonStr);
            expect(parsed.linkset).toBeDefined();
            expect(parsed.linkset[0].anchor).toContain('/api');
        });
    });

    describe('Route Handlers', () => {
        it('GET /.well-known/api-catalog returns 200 with application/linkset+json', async () => {
            const req = createMockRequest('https://craftmyfunnel.live/.well-known/api-catalog');
            const res = await getApiCatalogRoute(req);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/linkset+json');
            expect(res.headers.get('content-type')).toContain('profile="https://www.rfc-editor.org/info/rfc9727"');

            const body = await res.json();
            expect(body.linkset).toBeDefined();
            expect(body.linkset[0]['service-desc']).toBeDefined();
        });

        it('GET /api/openapi.json returns 200 with OpenAPI 3.1.0 schema', async () => {
            const req = createMockRequest('https://craftmyfunnel.live/api/openapi.json');
            const res = await getOpenApiRoute(req);

            expect(res.status).toBe(200);
            expect(res.headers.get('content-type')).toContain('application/json');

            const spec = await res.json();
            expect(spec.openapi).toBe('3.1.0');
            expect(spec.info).toBeDefined();
            expect(spec.info.title).toContain('CraftMyFunnel');
            expect(spec.paths).toBeDefined();
            expect(spec.paths['/api/health']).toBeDefined();
            expect(spec.paths['/api/v1/leads']).toBeDefined();
        });
    });
});
