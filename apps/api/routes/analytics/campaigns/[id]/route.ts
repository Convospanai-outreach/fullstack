import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { analyticsService } from "@/modules/analytics/service/analyticsService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id: campaignId } = await params;

    // Check ownership or team access
    const campaign = await prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { teamId: true, ownerId: true }
    });

    if (!campaign) {
        return new NextResponse("Campaign not found", { status: 404 });
    }

    // Verify user is in the team or is the owner
    const membership = await prisma.teamMember.findFirst({
        where: { userId, teamId: campaign.teamId || "" }
    });

    if (!membership && campaign.ownerId !== userId) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const stats = await analyticsService.getCampaignStats(campaignId);
        return NextResponse.json(stats);
    } catch (error: any) {
        return new NextResponse(error.message, { status: 500 });
    }
}
