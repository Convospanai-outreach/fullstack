import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getAgentSkillsDiscoveryIndexJson, getBaseSiteUrl } from '@/lib/agentSkills';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET(_req: NextRequest) {
    // Canonical host, not req.nextUrl.origin: force-static route, so the request
    // origin is meaningless at build time and would leak localhost (F-25).
    const origin = getBaseSiteUrl();

    return new NextResponse(getAgentSkillsDiscoveryIndexJson(origin), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
