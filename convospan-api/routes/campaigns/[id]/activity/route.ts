import { NextResponse } from "next/server";
import { AuditService } from "@/modules/audit/auditService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.user.findUnique({ where: { email: session.user?.email || "" } });
    if (!user) return new NextResponse("User not found", { status: 404 });
    const campaign = await prisma.campaign.findUnique({
        where: { id: params.id },
        select: { teamId: true, ownerId: true }
    });
    if (!campaign) return new NextResponse("Campaign not found", { status: 404 });
    const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id, teamId: campaign.teamId || "" }
    });
    if (!membership && campaign.ownerId !== user.id) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const activities = await AuditService.getResourceActivity("Campaign", params.id);
        return NextResponse.json({ success: true, activities });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
