import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { analyticsService } from "@/modules/analytics/service/analyticsService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const campaignId = params.id;

    // Check ownership or team access
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { teamId: true, ownerId: true }
    });

    if (!campaign) {
        return new NextResponse("Campaign not found", { status: 404 });
    }

    // Verify user is in the team or is the owner
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id, teamId: campaign.teamId || "" }
    });

    if (!membership && campaign.ownerId !== user.id) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const stats = await analyticsService.getCampaignStats(campaignId);
        return NextResponse.json(stats);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
