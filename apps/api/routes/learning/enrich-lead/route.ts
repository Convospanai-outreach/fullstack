import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { JobQueue } from "@/lib/queue";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leadId, campaignId, extraction } = body;
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const job = await JobQueue.enqueue("lead_enrichment", {
        leadId,
        teamId: ctx.teamId,
        campaignId,
        extraction
    });

    return NextResponse.json({ success: true, jobId: job.id });
}
