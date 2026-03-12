import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/queue/result
// Called by Chrome Extension to report success/failure
export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { commandId, status, details, duration } = body;

        if (!commandId || !status) {
            return NextResponse.json({ error: "Missing fields" }, { status: 400 });
        }

        // 1. Update Task Status
        const taskStatus = status === 'SUCCESS' ? 'COMPLETED' : 'FAILED';

        // Fetch current context to merge
        const currentTask = await prisma.agentTask.findUnique({ where: { id: commandId } });
        if (!currentTask) {
            return NextResponse.json({ error: "Task not found" }, { status: 404 });
        }

        const newContext = {
            ...(currentTask.context as object),
            executionResult: details,
            durationMs: duration || 0,
            executedAt: new Date().toISOString()
        };

        await prisma.agentTask.update({
            where: { id: commandId },
            data: {
                status: taskStatus,
                context: newContext
            }
        });

        // 2. Add specific Log entry
        await prisma.agentLog.create({
            data: {
                taskId: commandId,
                type: "ACTION",
                content: `Browser Execution ${status}: ${details}`,
                stepNumber: 0,
                metadata: { duration, source: "EXTENSION" }
            }
        });

        return NextResponse.json({ success: true, id: commandId });

    } catch (error: any) {
        console.error("[Queue API] Failed to report result:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
