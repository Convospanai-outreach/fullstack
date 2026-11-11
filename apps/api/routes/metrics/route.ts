import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { getMetrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
    const token = process.env['METRICS_TOKEN'];
    if (!token) return false;

    const provided = createHash('sha256').update(request.headers.get('authorization') ?? '').digest();
    const expected = createHash('sha256').update(`Bearer ${token}`).digest();
    return timingSafeEqual(provided, expected);
}

export async function GET(request: Request) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const metrics = await getMetrics();
        return new NextResponse(metrics, {
            headers: {
                'Content-Type': 'text/plain; version=0.0.4',
            },
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to collect metrics' }, { status: 500 });
    }
}
