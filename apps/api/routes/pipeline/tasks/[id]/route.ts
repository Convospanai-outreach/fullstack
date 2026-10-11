import { NextRequest, NextResponse } from 'next/server';
import { getCurrentContextFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { parseBody } from '@/lib/validation/parseBody';
import { SequenceService } from '@/modules/email-campaigner/service/sequenceService';
import { z } from 'zod';

// Task.status / Task.priority are String columns documented as TODO|DONE and
// LOW|MEDIUM|HIGH; any string used to be written through. An unparseable
// dueDate used to reach Prisma as Invalid Date and fail as a 500.
const patchTaskSchema = z.object({
    status: z.enum(['TODO', 'DONE']).optional(),
    title: z.string().max(500).optional(),
    description: z.string().max(5000).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    dueDate: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'Invalid date').optional(),
});

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

        const parsed = await parseBody(req, patchTaskSchema);
        if (!parsed.ok) return parsed.response;
        const { status, title, description, priority, dueDate } = parsed.data;

        // Verify task belongs to user's team
        const existingTask = await prisma.task.findFirst({
            where: { id, teamId },
            include: { lead: true }
        });

        if (!existingTask) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // A task a sequence step created: marking it done moves the sequence on to its next step.
        // Before the task update, so a failure here leaves the task open to be marked done again.
        if (status === 'DONE' && existingTask.status !== 'DONE' && existingTask.sequenceStepRunId) {
            await SequenceService.completeManualRun(teamId, existingTask.sequenceStepRunId);
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
