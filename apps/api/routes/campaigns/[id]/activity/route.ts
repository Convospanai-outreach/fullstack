import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getCurrentContextFromRequest(req);
    if (!ctx.userId || !ctx.teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { teamId: true, ownerId: true }
    });
    if (!campaign) return new NextResponse("Campaign not found", { status: 404 });
    const membership = await prisma.teamMember.findFirst({
        where: { userId: ctx.userId, teamId: campaign.teamId || "" }
    });
    if (!membership && campaign.ownerId !== ctx.userId) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const activities = await AuditService.getResourceActivity("Campaign", id);
        return NextResponse.json({ success: true, activities });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
