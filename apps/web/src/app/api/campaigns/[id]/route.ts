import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

async function getCampaignContext(id: string, requiredRole: TeamRole) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        throw new Error("Unauthorized");
    }

    await authorizeRole(userId, teamId, requiredRole);
    const { prisma } = await import("@/lib/db");

    const campaign = await prisma.campaign.findFirst({
        where: { id, teamId },
        include: { leadList: true },
    });

    if (!campaign) {
        throw new Error("Campaign not found");
    }

    return { campaign, teamId, userId, prisma };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { campaign } = await getCampaignContext(id, TeamRole.VIEWER);

        let stats = null;
        try {
            const { CampaignService } = await import("@/lib/campaignService");
            stats = await CampaignService.getCampaignStats(id);
        } catch (_e) {
            // Fallback stats if CampaignService call encounters transient error
            stats = { totalLeads: campaign.leadList.length, completedCount: campaign.completedCount };
        }

        return NextResponse.json({
            ...campaign,
            leads: campaign.leadList,
            stats,
        });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { prisma } = await getCampaignContext(id, TeamRole.MEMBER);
        const body = await req.json();

        const { CampaignService } = await import("@/lib/campaignService");

        if (body.action === "start") {
            await CampaignService.startCampaign(id);
        } else if (body.action === "pause" || body.status === "paused") {
            await CampaignService.pauseCampaign(id);
        } else if (body.leadIds) {
            await CampaignService.addLeadsToCampaign(id, body.leadIds);
        } else {
            const allowedUpdates: Record<string, unknown> = {};
            if (typeof body.name === "string") allowedUpdates["name"] = body.name;
            if (typeof body.description === "string" || body.description === null) {
                allowedUpdates["description"] = body.description;
            }
            if (typeof body.status === "string") allowedUpdates["status"] = body.status;
            if (typeof body.targetCount === "number") allowedUpdates["targetCount"] = body.targetCount;
            if (typeof body.completedCount === "number") allowedUpdates["completedCount"] = body.completedCount;

            if (Object.keys(allowedUpdates).length > 0) {
                await prisma.campaign.update({
                    where: { id },
                    data: allowedUpdates,
                });
            }
        }

        const updated = await prisma.campaign.findUnique({
            where: { id },
            include: { leadList: true },
        });

        return NextResponse.json({ success: true, campaign: updated, leads: updated?.leadList || [] });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, prisma } = await getCampaignContext(id, TeamRole.ADMIN);
        await prisma.campaign.deleteMany({ where: { id, teamId } });
        return NextResponse.json({ success: true });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}
