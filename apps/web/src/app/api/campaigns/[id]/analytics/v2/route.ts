import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { analyticsService } from "@/modules/analytics/analyticsService";

export const dynamic = "force-dynamic";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { prisma } = await import("@/lib/db");

    try {
        const campaign = await prisma.campaign.findFirst({
            where: { id, teamId: ctx.teamId },
            select: { id: true }
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

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
