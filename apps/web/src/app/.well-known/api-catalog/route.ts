import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getApiCatalogDocument, getBaseSiteUrl } from '@/lib/apiCatalog';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET(req: NextRequest) {
    const origin = req.nextUrl.origin || getBaseSiteUrl();
    const catalog = getApiCatalogDocument(origin);

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

export async function HEAD(req: NextRequest) {
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
