import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";

// GET /api/campaigns/[id]/analytics - Campaign analytics
export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { teamId } = await getCurrentContext();
        if (!teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const campaign = await prisma.campaign.findFirst({
            where: { id, teamId },
            include: {
                leadList: {
                    select: {
                        status: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!campaign) {
            return NextResponse.json(
                { error: "Campaign not found" },
                { status: 404 }
            );
        }

        // Calculate stats
        const totalLeads = campaign.leadList.length;
        const leadsByStatus = campaign.leadList.reduce((acc: any, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            return acc;
        }, {});

        const completionRate =
            campaign.targetCount > 0
                ? (campaign.completedCount / campaign.targetCount) * 100
                : 0;

        // Timeline data - leads created per day for last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const timelineData = campaign.leadList
            .filter((lead) => lead.createdAt >= thirtyDaysAgo)
            .reduce((acc: Record<string, number>, lead) => {
                const date = lead.createdAt.toISOString().split("T")[0];
                if (date) {
                    acc[date] = (acc[date] || 0) + 1;
                }
                return acc;
            }, {});

        return NextResponse.json({
            campaignId: campaign.id,
            campaignName: campaign.name,
            status: campaign.status,
            totalLeads,
            targetCount: campaign.targetCount,
            completedCount: campaign.completedCount,
            completionRate: Math.round(completionRate * 100) / 100,
            leadsByStatus,
            timelineData,
            createdAt: campaign.createdAt,
            updatedAt: campaign.updatedAt,
        });
    } catch (error) {
        console.error("Error fetching analytics:", error);
        return NextResponse.json(
            { error: "Failed to fetch analytics" },
            { status: 500 }
        );
    }
}
