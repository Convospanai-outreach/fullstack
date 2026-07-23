import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
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
        }).catch((err) => {
            console.warn("handleCampaignExecution warning:", err?.message || err);
            return { enqueued: 0 };
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
