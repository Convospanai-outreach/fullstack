import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentContext } from '@/lib/auth';
import { checkTeamPermission, TeamRole } from '@/lib/permissions';

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!teamId) {
            return NextResponse.json({ error: 'Workspace Not Found' }, { status: 404 });
        }
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch experiments with variants
        const experiments = await prisma.experiment.findMany({
            where: { teamId },
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
