import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

// POST /api/jobs/[id]/retry - Retry failed job
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const existing = await prisma.job.findFirst({
            where: { id, teamId: ctx.teamId }
        });
        if (!existing) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const job = await prisma.job.update({
            where: { id },
            data: {
                status: "pending",
                attempts: 0,
                processAt: new Date()
            }
        });
        return NextResponse.json(job);
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Failed to retry job";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
