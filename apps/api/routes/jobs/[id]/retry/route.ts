import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/jobs/[id]/retry - Retry failed job
export async function POST(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
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
