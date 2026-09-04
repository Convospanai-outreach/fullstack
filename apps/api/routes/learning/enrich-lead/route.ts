import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { JobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leadId, campaignId, extraction } = body;
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    // leadId is caller-supplied - verify it belongs to the caller's own team,
    // matching the pattern in whatsapp/send/route.ts, so a caller can't
    // enrich (and get billed for enriching) another team's lead, then have
    // the resulting data dispatched to their own webhook.
    const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId: ctx.teamId } });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const job = await JobQueue.enqueue("lead_enrichment", {
        leadId,
        teamId: ctx.teamId,
        campaignId,
        extraction
    });

    return NextResponse.json({ success: true, jobId: job.id });
}
