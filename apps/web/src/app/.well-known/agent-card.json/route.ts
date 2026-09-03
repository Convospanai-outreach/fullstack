import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getA2AAgentCardJson } from '@/lib/a2aAgentCard';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET(req: NextRequest) {
    const origin = req.nextUrl.origin;

    return new NextResponse(getA2AAgentCardJson(origin), {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
