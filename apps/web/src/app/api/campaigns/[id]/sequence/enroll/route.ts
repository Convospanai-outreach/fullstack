import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { enrollCampaignLeads } from "@/lib/campaigns/enrollment";

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Every sibling mutating campaigns/* route requires at least MEMBER -
        // without this, a read-only VIEWER could activate live outreach to
        // every lead in the campaign.
        if (!(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const { prisma } = await import("@/lib/db");
        const { id: campaignId } = await params;

        const campaign = await prisma.campaign.findFirst({
            where: { id: campaignId, teamId },
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        const result = await enrollCampaignLeads(campaignId, teamId);
        if (!result.ok) {
            // NO_SEQUENCE and UNSUPPORTED_STEP are both caller-fixable (400).
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            candidates: result.candidates,
            enrolled: result.enrolled,
            alreadyEnrolled: result.alreadyEnrolled,
            ...(result.message ? { message: result.message } : {}),
        });
    } catch (error: any) {
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
