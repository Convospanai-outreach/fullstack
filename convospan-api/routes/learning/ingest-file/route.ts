import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { JobQueue } from "@/lib/queue";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { filePath, campaignId } = body;
    if (!filePath) return NextResponse.json({ error: "filePath required" }, { status: 400 });

    const path = await import("path");
    const job = await JobQueue.enqueue("CSV_IMPORT", {
        teamId: ctx.teamId,
        filePath,
        campaignId,
        originalFilename: path.basename(filePath)
    });

    return NextResponse.json({ success: true, jobId: job.id });
}
