import { describe, expect, it } from 'vitest';
import { GET, HEAD } from './route';

describe('RFC 9727 API Catalog in apps/api', () => {
    it('GET /.well-known/api-catalog returns 200 with application/linkset+json', async () => {
        const req = new Request('https://craftmyfunnel.live/.well-known/api-catalog');
        const res = await GET(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/linkset+json');
        expect(res.headers.get('content-type')).toContain('profile="https://www.rfc-editor.org/info/rfc9727"');
        expect(res.headers.get('link')).toContain('</.well-known/api-catalog>; rel="self"');

        const body = await res.json();
        expect(body.linkset).toBeDefined();
        expect(body.linkset[0].anchor).toBe('https://craftmyfunnel.live/api');
        expect(body.linkset[0]['service-desc'][0].href).toBe('https://craftmyfunnel.live/api/openapi.json');
        expect(body.linkset[0]['service-doc'][0].href).toBe('https://craftmyfunnel.live/docs/api');
        expect(body.linkset[0].status[0].href).toBe('https://craftmyfunnel.live/api/health');
    });

    it('HEAD /.well-known/api-catalog returns 200 with link headers', async () => {
        const req = new Request('https://craftmyfunnel.live/.well-known/api-catalog');
        const res = await HEAD(req);

        expect(res.status).toBe(200);
        expect(res.headers.get('content-type')).toContain('application/linkset+json');
        expect(res.headers.get('link')).toContain('</.well-known/api-catalog>; rel="self"');
    });
});
