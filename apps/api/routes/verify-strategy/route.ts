
import { NextResponse } from "next/server";
import { CampaignService } from "@/lib/campaignService";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET() {
    if (process.env["ENABLE_VERIFY_STRATEGY_ROUTE"] !== "true") {
        return NextResponse.json({ error: "Route disabled" }, { status: 404 });
    }

    try {
        logger.info("Creating campaign via service for in-band verification");

        const team = await prisma.team.findFirst();
        if (!team) return NextResponse.json({ error: "No team found" }, { status: 500 });

        const campaign = await CampaignService.createCampaign({
            name: "Test Strategy Campaign (API)",
            targetCount: 100,
            teamId: team.id,
            aiConfig: {
                executionMode: "saferun",
                tone: "Professional",
                context: "Testing SafeRun persistence via API"
            }
        });

        logger.info("Created verification campaign", { campaignId: campaign.id });

        const storedCampaign = await prisma.campaign.findUnique({
            where: { id: campaign.id }
        });

        if (!storedCampaign) {
            return NextResponse.json({ error: "Campaign not persisted" }, { status: 500 });
        }

        const storedConfig = storedCampaign.aiConfig as any;

        // Cleanup
        await prisma.campaign.delete({ where: { id: campaign.id } });

        if (storedConfig?.executionMode === "saferun") {
            return NextResponse.json({ success: true, message: "executionMode 'saferun' persisted correctly." });
        } else {
            return NextResponse.json({
                error: "Verification Failed",
                actual: storedConfig
            }, { status: 500 });
        }

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
