import { NextResponse } from 'next/server';
import { getWebBotAuthDirectoryJson } from '@/lib/webBotAuth';

export const dynamic = 'force-static';
export const revalidate = 86400; // 24 hours

export async function GET() {
    return new NextResponse(getWebBotAuthDirectoryJson(), {
        status: 200,
        headers: {
            'Content-Type': 'application/http-message-signatures-directory+json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
    });
}
