import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateExtensionAuth } from "../../_lib/auth";
import { resolveExtensionTeamScope } from "../../_lib/teamScope";

export async function POST(req: NextRequest) {
    try {
        const auth = await validateExtensionAuth(req);
        if (!auth.ok) {
            return NextResponse.json({ error: auth.error }, { status: auth.status });
        }
        const body = await req.json();
        const requestedTeamId = typeof body?.teamId === "string" ? body.teamId : req.headers.get("x-team-id");
        const teamScope = resolveExtensionTeamScope(auth.teamIds, requestedTeamId);
        if (!teamScope.ok) {
            return NextResponse.json({ error: teamScope.error, code: teamScope.code }, { status: teamScope.status });
        }
        const teamId = teamScope.teamId;

        const { taskId, success, result, error } = body;

        if (!taskId) {
            return NextResponse.json({ error: "Missing taskId" }, { status: 400 });
        }

        const job = await prisma.job.findFirst({
            where: { id: taskId, teamId },
            select: {
                id: true,
                status: true,
                result: true,
                error: true
            }
        });
        if (!job) {
            return NextResponse.json({ error: "Task not found for current user/team" }, { status: 404 });
        }

        if (job.status === "completed" || job.status === "failed") {
            return NextResponse.json({
                success: true,
                jobId: job.id,
                status: job.status
            });
        }

        const terminalStatus = success ? "completed" : "failed";
        const updateResult = await prisma.job.updateMany({
            where: {
                id: job.id,
                teamId,
                status: "processing"
            },
            data: {
                status: terminalStatus,
                result: result || undefined,
                error: error || undefined,
                completedAt: new Date()
            }
        });

        if (updateResult.count === 0) {
            const latest = await prisma.job.findFirst({
                where: { id: job.id, teamId },
                select: { id: true, status: true }
            });
            if (!latest) {
                return NextResponse.json({ error: "Task not found for current user/team" }, { status: 404 });
            }

            if (latest.status === "completed" || latest.status === "failed") {
                return NextResponse.json({
                    success: true,
                    jobId: latest.id,
                    status: latest.status
                });
            }

            return NextResponse.json(
                { error: "Task is no longer claimable" },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            jobId: job.id,
            status: terminalStatus
        });

    } catch (error: any) {
        console.error("Error completing extension task:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
