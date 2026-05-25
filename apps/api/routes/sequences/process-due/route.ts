import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { JobQueue } from "@/lib/queue";
import { SequenceService } from "@/modules/email-campaigner/service/sequenceService";

function readLimit(value: unknown) {
    return typeof value === "number" && Number.isFinite(value)
        ? Math.min(Math.max(Math.floor(value), 1), 100)
        : undefined;
}

export async function POST(req: NextRequest) {
    try {
        const ctx = await getCurrentContext();
        if (!ctx.userId || !ctx.teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const limit = readLimit(body?.limit);

        if (body?.inline === true) {
            const result = await SequenceService.processDue({ teamId: ctx.teamId, limit });
            return NextResponse.json(result);
        }

        const job = await JobQueue.enqueue(
            "sequence_execution" as any,
            { teamId: ctx.teamId, limit },
            {
                teamId: ctx.teamId,
                processAt: new Date(),
                idempotencyKey: body?.idempotencyKey,
            },
        );

        return NextResponse.json({ jobId: job.id, status: job.status }, { status: 202 });
    } catch (error: any) {
        console.error("[Sequences] Failed to process due sequence steps:", error);
        return NextResponse.json({ error: error?.message || "Failed to process due sequence steps" }, { status: 500 });
    }
}
