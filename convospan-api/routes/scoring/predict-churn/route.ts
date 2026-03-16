import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { predictiveService } from "@/modules/scoring";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { leadId } = body;
    if (!leadId) return NextResponse.json({ error: "leadId required" }, { status: 400 });

    const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { teamId: true } });
    if (!lead || lead.teamId !== ctx.teamId) {
        return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const result = await predictiveService.predictChurn(leadId);
    return NextResponse.json(result);
}
