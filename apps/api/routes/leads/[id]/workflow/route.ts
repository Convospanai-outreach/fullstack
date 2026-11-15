import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { deriveLeadWorkflow } from "@/lib/leadWorkflow";

// GET /api/leads/[id]/workflow - read-only six-step view of where a lead is, built from existing records.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const lead = await prisma.lead.findFirst({
        where: { id, teamId: ctx.teamId },
        select: {
            isEnriched: true,
            lastScoredAt: true,
            dwellTimeMinutes: true,
            emailClicks: true,
            socialMentions: true,
            icpFitScore: true,
            replyOutcome: true,
            pipelineState: true,
            status: true,
            wonAt: true,
        },
    });
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });

    const [emailCount, repliedEmailCount, generationCount, channels, approval] = await Promise.all([
        prisma.email.count({ where: { leadId: id } }),
        prisma.email.count({ where: { leadId: id, repliedAt: { not: null } } }),
        prisma.generation.count({ where: { leadId: id } }),
        prisma.leadChannelStatus.findMany({ where: { leadId: id }, select: { status: true } }),
        prisma.approvalRequest.findFirst({
            where: { teamId: ctx.teamId, entityType: "Lead", entityId: id },
            orderBy: { createdAt: "desc" },
            select: { id: true, status: true, actionType: true, reason: true, autoDenyAt: true },
        }),
    ]);

    const data = deriveLeadWorkflow({
        lead,
        emailCount,
        repliedEmailCount,
        generationCount,
        channelStatuses: channels.map((c) => c.status),
        approval,
    });
    return NextResponse.json({ success: true, data });
}
