import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";

export async function GET() {
    try {
        const { teamId } = await getCurrentContext();
        if (!teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        // 1. Fetch Active Campaigns Count
        const activeCampaigns = await prisma.campaign.count({
            where: {
                teamId,
                status: "ACTIVE"
            }
        });

        // 2. Calculate Engagement Rate (Mocked calculation from events for now)
        // In a real scenario, we'd count 'REPLY_RECEIVED' events vs 'EMAIL_SENT'
        const totalSent = await prisma.systemEvent.count({
            where: { teamId, name: "EMAIL_SENT" }
        }) || 100; // Fallback to avoid div by zero in mock dev

        const totalReplies = await prisma.systemEvent.count({
            where: { teamId, name: "REPLY_RECEIVED" }
        });

        const engagementRate = Math.round((totalReplies / totalSent) * 100);
        
        // Comparison with "yesterday" (simplified for briefing)
        const improvement = 12; // Static for now, could be dynamic with date filtering

        // 3. Fetch Pending Approvals
        const pendingApprovals = await prisma.approvalRequest.count({
            where: {
                teamId,
                status: "PENDING"
            }
        });

        // 4. Get most recent high-value campaign name
        const topCampaign = await prisma.campaign.findFirst({
            where: { teamId, status: "ACTIVE" },
            orderBy: { createdAt: 'desc' },
            select: { name: true }
        });

        const campaignName = topCampaign?.name || "Target Outreach";

        return NextResponse.json({
            activeCampaigns,
            engagementRate,
            improvement,
            pendingApprovals,
            campaignName
        });

    } catch (error: any) {
        return handleAPIError(error);
    }
}
