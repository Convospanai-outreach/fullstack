import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

// GET /api/jobs/[id] - Get job status
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const job = await prisma.job.findFirst({
            where: { id, teamId: ctx.teamId }
        });

        if (!job) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        return NextResponse.json(job);
    } catch (error) {
        console.error("Error fetching job:", error);
        return NextResponse.json(
            { error: "Failed to fetch job" },
            { status: 500 }
        );
    }
}

// DELETE /api/jobs/[id] - Cancel job
export async function DELETE(
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
            data: { status: "failed", error: "Cancelled by user" }
        });
        return NextResponse.json(job);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to cancel job";
        return NextResponse.json({ error: message }, { status: 400 });
    }
}
