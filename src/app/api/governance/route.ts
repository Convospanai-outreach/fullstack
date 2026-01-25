import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch experiments with variants
        const experiments = await prisma.experiment.findMany({
            include: {
                variants: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 20,
        });

        // Fetch training datasets
        const datasets = await prisma.trainingDataset.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: 50,
        });

        return NextResponse.json({
            experiments,
            datasets,
        });
    } catch (error) {
        console.error('Error fetching governance data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch governance data' },
            { status: 500 }
        );
    }
}
