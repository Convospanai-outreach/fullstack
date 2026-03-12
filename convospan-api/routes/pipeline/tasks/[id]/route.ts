import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = params;
        const body = await req.json();
        const { status, title, description, priority, dueDate } = body;

        // Verify task belongs to user's team
        const existingTask = await prisma.task.findUnique({
            where: { id },
            include: { lead: true }
        });

        if (!existingTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Update task
        const updatedTask = await prisma.task.update({
            where: { id },
            data: {
                ...(status && { status }),
                ...(title && { title }),
                ...(description && { description }),
                ...(priority && { priority }),
                ...(dueDate && { dueDate: new Date(dueDate) })
            },
            include: {
                lead: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            data: updatedTask
        });
    } catch (error) {
        console.error('[Task API] Update failed:', error);
        return NextResponse.json(
            { error: 'Failed to update task' },
            { status: 500 }
        );
    }
}
