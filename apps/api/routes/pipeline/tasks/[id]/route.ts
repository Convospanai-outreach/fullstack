import { NextRequest, NextResponse } from 'next/server';
import { getCurrentContextFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId, teamId } = await getCurrentContextFromRequest(req);
        if (!userId || !teamId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { status, title, description, priority, dueDate } = body;

        // Verify task belongs to user's team
        const existingTask = await prisma.task.findFirst({
            where: { id, teamId },
            include: { lead: true }
        });

        if (!existingTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Update task - scoped by teamId here too, not just the pre-check
        // above, same defense-in-depth anti-pattern already fixed under
        // OPEN-99/109/110/118/120/121/122/123.
        const updateResult = await prisma.task.updateMany({
            where: { id, teamId },
            data: {
                ...(status && { status }),
                ...(title && { title }),
                ...(description && { description }),
                ...(priority && { priority }),
                ...(dueDate && { dueDate: new Date(dueDate) })
            }
        });
        if (updateResult.count === 0) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        const updatedTask = await prisma.task.findFirst({
            where: { id, teamId },
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
