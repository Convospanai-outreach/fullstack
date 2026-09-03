import { describe, expect, it } from 'vitest';
import { DISCOVERY_LINK_HEADER } from '../../src/lib/apiCatalog';

describe('RFC 8288 & RFC 9727 Link Response Headers', () => {
    it('contains all required registered relation types for agent discovery', () => {
        expect(DISCOVERY_LINK_HEADER).toBeDefined();

        // 1. api-catalog relation (RFC 9727)
        expect(DISCOVERY_LINK_HEADER).toContain('</.well-known/api-catalog>; rel="api-catalog"');

        // 2. service-desc relation (RFC 8631 / RFC 9727)
        expect(DISCOVERY_LINK_HEADER).toContain('</api/openapi.json>; rel="service-desc"; type="application/json"');

        // 3. service-doc relation (RFC 8631 / RFC 9727)
        expect(DISCOVERY_LINK_HEADER).toContain('</docs>; rel="service-doc"; type="text/html"');

        // 4. describedby relation (RFC 9727 / LLMs.txt)
        expect(DISCOVERY_LINK_HEADER).toContain('</llms.txt>; rel="describedby"; type="text/plain"');
    });

    it('can be parsed into individual RFC 8288 web links', () => {
        const links = DISCOVERY_LINK_HEADER.split(',').map((l) => l.trim());
        expect(links.length).toBe(4);

        const relTypes = links.map((link) => {
            const match = link.match(/rel="([^"]+)"/);
            return match ? match[1] : null;
        });

        expect(relTypes).toContain('api-catalog');
        expect(relTypes).toContain('service-desc');
        expect(relTypes).toContain('service-doc');
        expect(relTypes).toContain('describedby');
    });
});
