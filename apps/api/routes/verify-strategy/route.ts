
import { NextResponse } from "next/server";
import { CampaignService } from "@/lib/campaignService";
import { prisma } from "@/lib/db";

export async function GET() {
    // Security: Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    try {
        console.log("1. Creating Campaign via Service (In-Band Verification)...");

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

        console.log(`   > Created Campaign ID: ${campaign.id}`);

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
