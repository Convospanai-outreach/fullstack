import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

// POST /api/jobs/[id]/retry - Retry failed job
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const job = await prisma.job.update({
            where: { id: params.id },
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
