import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

function getBaseSiteUrl(): string {
    return (process.env['NEXT_PUBLIC_SITE_URL'] || process.env['NEXTAUTH_URL'] || 'https://craftmyfunnel.live').replace(/\/$/, '');
}

function getCatalog(origin: string) {
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

export async function GET(req: Request) {
    const origin = new URL(req.url).origin || getBaseSiteUrl();
    const catalog = getCatalog(origin);

    return new NextResponse(JSON.stringify(catalog, null, 2), {
        status: 200,
        headers: {
            'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
            'Link': '</.well-known/api-catalog>; rel="self"; type="application/linkset+json"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}

export async function HEAD(req: Request) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"',
            'Link': '</.well-known/api-catalog>; rel="self"; type="application/linkset+json"',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
