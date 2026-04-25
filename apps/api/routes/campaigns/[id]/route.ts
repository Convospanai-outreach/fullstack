import { NextResponse } from "next/server";
import { CampaignService } from "@/lib/campaignService";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

async function requireCampaignContext(id: string, requiredRole: TeamRole) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    await authorizeRole(userId, teamId, requiredRole);

    const campaign = await prisma.campaign.findFirst({
        where: { id, teamId },
    });

    if (!campaign) {
        throw new APIError("Campaign not found", 404, "NOT_FOUND");
    }

    return { campaign, teamId };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { campaign } = await requireCampaignContext(id, TeamRole.VIEWER);
        const stats = await CampaignService.getCampaignStats(id);
        return NextResponse.json({ ...campaign, stats });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        await requireCampaignContext(id, TeamRole.MEMBER);
        const body = await req.json();
        if (body.action === "start") {
            await CampaignService.startCampaign(id);
        } else if (body.action === "pause") {
            await CampaignService.pauseCampaign(id);
        } else if (body.leadIds) {
            await CampaignService.addLeadsToCampaign(id, body.leadIds);
        } else {
            const allowedUpdates: Record<string, unknown> = {};
            if (typeof body.name === "string") allowedUpdates.name = body.name;
            if (typeof body.description === "string" || body.description === null) {
                allowedUpdates.description = body.description;
            }
            if (typeof body.status === "string") allowedUpdates.status = body.status;
            if (typeof body.targetCount === "number") allowedUpdates.targetCount = body.targetCount;
            if (typeof body.completedCount === "number") allowedUpdates.completedCount = body.completedCount;

            if (Object.keys(allowedUpdates).length === 0) {
                throw new APIError("No valid update fields provided", 400, "VALIDATION_ERROR");
            }

            await prisma.campaign.update({
                where: { id },
                data: allowedUpdates,
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId } = await requireCampaignContext(id, TeamRole.ADMIN);
        await prisma.campaign.deleteMany({ where: { id, teamId } });
        return NextResponse.json({ success: true });
    } catch (error) {
        return handleAPIError(error);
    }
}
