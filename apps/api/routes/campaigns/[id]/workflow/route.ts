import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { loadLeadWorkflows, summariseWorkflows } from "@/lib/leadWorkflowBatch";

// Enough for the campaigns seen so far; `capped` tells the page when the counts cover only the newest leads.
const MAX_LEADS = 2000;

// GET /api/campaigns/[id]/workflow - how many of the campaign's leads sit at each of the six steps. Read-only.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const campaign = await prisma.campaign.findFirst({ where: { id, teamId: ctx.teamId }, select: { id: true } });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const leads = await prisma.lead.findMany({
        where: { campaignId: id, teamId: ctx.teamId },
        orderBy: { createdAt: "desc" },
        take: MAX_LEADS + 1,
        select: { id: true },
    });
    const capped = leads.length > MAX_LEADS;
    const ids = leads.slice(0, MAX_LEADS).map((l) => l.id);

    const workflows = await loadLeadWorkflows(ctx.teamId, ids);
    return NextResponse.json({
        success: true,
        data: { leadCount: ids.length, capped, steps: summariseWorkflows(workflows.values()) },
    });
}
