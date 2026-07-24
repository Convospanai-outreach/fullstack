import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { getCurrentContext } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/db");
    const { id } = await params;

    const campaign = await prisma.campaign.findUnique({
        where: { id },
        select: { teamId: true, ownerId: true }
    });

    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    const membership = await prisma.teamMember.findFirst({
        where: { userId: ctx.userId, teamId: campaign.teamId || "" }
    });

    if (!membership && campaign.ownerId !== ctx.userId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    try {
        const activities = await AuditService.getResourceActivity("Campaign", id);
        return NextResponse.json({ success: true, activities });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
