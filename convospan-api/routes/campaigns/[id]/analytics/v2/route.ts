import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { analyticsService } from "@/modules/analytics/analyticsService";
import { prisma } from "@/lib/prisma";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const [funnel, timeline, leadsStatus] = await Promise.all([
            analyticsService.getCampaignFunnel(id),
            analyticsService.getActivityTimeline(id),
            prisma.lead.groupBy({
                by: ['status'],
                where: { campaignId: id },
                _count: { id: true }
            })
        ]);

        const formattedLeadsStatus = leadsStatus.reduce((acc, curr) => {
            acc[curr.status] = curr._count.id;
            return acc;
        }, {} as Record<string, number>);

        return NextResponse.json({
            success: true,
            data: {
                funnel,
                timeline,
                leadsByStatus: formattedLeadsStatus
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
