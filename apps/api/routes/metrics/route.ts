import { NextResponse } from 'next/server';
import { getMetrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

function isAuthorized(request: Request) {
    const token = process.env['METRICS_TOKEN'];
    const authorization = request.headers.get('authorization');

    if (!token) {
        return process.env['NODE_ENV'] !== 'production';
    }

    return authorization === `Bearer ${token}`;
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
