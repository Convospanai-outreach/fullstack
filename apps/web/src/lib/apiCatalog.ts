/**
 * RFC 9727: api-catalog Well-Known URI and Link Relation
 * https://www.rfc-editor.org/rfc/rfc9727
 * https://www.rfc-editor.org/rfc/rfc9727#appendix-A
 */

export interface LinksetEntry {
    anchor: string;
    'service-desc': Array<{ href: string; type: string }>;
    'service-doc': Array<{ href: string; type: string }>;
    status?: Array<{ href: string; type: string }>;
    'service-meta'?: Array<{ href: string; type: string }>;
}

export interface ApiCatalogDocument {
    linkset: LinksetEntry[];
}

/**
 * RFC 8288 / RFC 9727 Link Header for Machine Discovery
 */
export const DISCOVERY_LINK_HEADER =
    '</.well-known/api-catalog>; rel="api-catalog", </api/openapi.json>; rel="service-desc"; type="application/json", </docs>; rel="service-doc"; type="text/html", </llms.txt>; rel="describedby"; type="text/plain"';

export function getBaseSiteUrl(): string {
    return (process.env['NEXT_PUBLIC_SITE_URL'] || process.env['NEXTAUTH_URL'] || 'https://craftmyfunnel.live').replace(/\/$/, '');
}

export function getApiCatalogDocument(baseUrl?: string): ApiCatalogDocument {
    const origin = baseUrl || getBaseSiteUrl();

    return {
        linkset: [
            {
                anchor: `${origin}/api`,
                'service-desc': [
                    {
                        href: `${origin}/api/openapi.json`,
                        type: 'application/json',
                    },
                ],
                'service-doc': [
                    {
                        href: `${origin}/docs/api`,
                        type: 'text/html',
                    },
                ],
                status: [
                    {
                        href: `${origin}/api/health`,
                        type: 'application/json',
                    },
                ],
                'service-meta': [
                    {
                        href: `${origin}/llms.txt`,
                        type: 'text/plain',
                    },
                ],
            },
            {
                anchor: `${origin}/api/v1`,
                'service-desc': [
                    {
                        href: `${origin}/api/openapi.json`,
                        type: 'application/json',
                    },
                ],
                'service-doc': [
                    {
                        href: `${origin}/docs`,
                        type: 'text/html',
                    },
                ],
                status: [
                    {
                        href: `${origin}/api/health`,
                        type: 'application/json',
                    },
                ],
            },
        ],
    };
}

export function getApiCatalogJson(baseUrl?: string): string {
    return JSON.stringify(getApiCatalogDocument(baseUrl), null, 2);
}
