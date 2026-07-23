import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleCampaignExecution } from "@/workers/handlers/campaign-execution-worker";

export async function POST(request: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const campaignId = body.campaignId || body.id;

        if (!campaignId) {
            return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
        }

        // 1. Verify and activate campaign
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

        // 2. Trigger campaign execution worker to process leads & dispatch emails
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
        console.error("POST /api/orchestrator/run error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
