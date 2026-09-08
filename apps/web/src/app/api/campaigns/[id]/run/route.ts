import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { handleCampaignExecution } from "@/workers/handlers/campaign-execution-worker";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Every sibling mutating campaigns/* route requires at least MEMBER -
        // without this, a read-only VIEWER could unilaterally launch a live
        // outbound campaign.
        if (!(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const { id: campaignId } = await params;
        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId },
        });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: "active" },
        });

        const result = await handleCampaignExecution({
            campaignId,
            teamId,
            userId,
        });

        return NextResponse.json({
            success: true,
            status: "active",
            campaignId,
            enqueued: result.enqueued,
        });
    } catch (error: any) {
        console.error("POST /api/campaigns/[id]/run error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
