import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }

        const body = await req.json();
        const { taskId, success, result, error } = body;

        if (!taskId) {
            return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
        }

        const job = await prisma.job.findFirst({
            where: { id: taskId, teamId: { in: auth.teamIds } },
            select: { id: true }
        });
        if (!job) {
            return NextResponse.json({ error: "Task not found for current user/team" }, { status: 404 });
        }

        // Update job status for team-authorized task
        const updated = await prisma.job.update({
            where: { id: job.id },
            data: {
                status: success ? "completed" : "failed",
                result: result || undefined,
                error: error || undefined,
                completedAt: new Date()
            }
        });

        // Trigger side-effects if needed? (e.g. if VIEW_PROFILE success, enrich lead)
        // This is handled by Orchestrator usually, but here we just update DB.

        return NextResponse.json({ success: true, jobId: updated.id });

    } catch (error: any) {
        console.error("Error completing extension task:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
