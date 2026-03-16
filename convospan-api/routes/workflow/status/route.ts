import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const executionId = searchParams.get("executionId");
    if (!executionId) return NextResponse.json({ error: "executionId required" }, { status: 400 });

    const run = await prisma.workflowRun.findUnique({
        where: { id: executionId },
        include: { workflow: true }
    });

    if (!run || run.workflow.teamId !== ctx.teamId) {
        return NextResponse.json({ status: "UNKNOWN" }, { status: 404 });
    }

    return NextResponse.json({
        status: run.status,
        completedAt: run.completedAt,
        error: run.error
    });
}
