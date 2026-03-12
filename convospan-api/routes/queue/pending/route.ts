import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/queue/pending
// Called by Chrome Extension to fetch next Approved task
export async function GET(_req: Request) {
    try {
        // Fetch oldest EXECUTING task meant for BROWSER
        // We use context filters which might be slow on large tables without index, 
        // but for <100 operational tasks it's fine.
        const tasks = await prisma.agentTask.findMany({
            where: {
                status: "EXECUTING",
            },
            orderBy: { createdAt: "asc" },
            take: 10 // Fetch a batch to filter in memory if needed
        });

        // Filter for tasks demanding browser execution
        const pendingCommand = tasks.find(t => (t.context as any)?.mode === 'BROWSER');

        if (!pendingCommand) {
            return NextResponse.json({ command: null });
        }

        // Construct the command payload expected by extension
        const context: any = pendingCommand.context || {};

        const command = {
            id: pendingCommand.id,
            type: context.actionType || 'CONNECT', // Default or from context
            target: context.targetUrl || "https://linkedin.com",
            details: context.draft || "No content",
            metadata: context
        };

        return NextResponse.json({ command });

    } catch (error: any) {
        console.error("[Queue API] Failed to fetch pending:", error);



        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
