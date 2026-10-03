import { NextResponse } from "next/server";
import { CampaignService } from "@/lib/campaignService";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { z } from "zod";

// Campaign.status is a free-form String column; these are the values the app
// actually writes (campaignService, campaign-worker, orchestrator/run).
const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "scheduled"] as const;

const patchCampaignSchema = z.object({
    action: z.enum(["start", "pause"]).optional(),
    status: z.enum(CAMPAIGN_STATUSES).optional(),
    leadIds: z.array(z.string().min(1)).optional(),
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).nullable().optional(),
    targetCount: z.number().int().nonnegative().optional(),
    completedCount: z.number().int().nonnegative().optional(),
    draftGenerationMode: z.enum(["REALTIME", "BATCH"]).optional(),
});

async function requireCampaignContext(id: string, requiredRole: TeamRole) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    await authorizeRole(userId, teamId, requiredRole);

    const campaign = await prisma.campaign.findFirst({
        where: { id, teamId },
        include: { leadList: true },
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
        return NextResponse.json({
            ...campaign,
            leads: campaign.leadList,
            stats,
        });
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId, campaign } = await requireCampaignContext(id, TeamRole.MEMBER);
        const parsed = await parseBody(req, patchCampaignSchema);
        if (!parsed.ok) return parsed.response;
        const body = parsed.data;
        if (body.draftGenerationMode !== undefined) {
            // BATCH submits once the enrichment counter seeded at campaign start reaches 0, so the mode
            // can't change after start without stranding in-flight leads.
            if (campaign.status !== "draft") {
                throw new APIError("Draft generation mode can only be changed before the campaign starts", 409, "CONFLICT");
            }
            // Applied first so a combined { status: "active", draftGenerationMode } request starts with the new mode.
            await prisma.campaign.update({ where: { id }, data: { draftGenerationMode: body.draftGenerationMode } });
        }
        if (body.action === "start" || body.status === "active") {
            await CampaignService.startCampaign(id);
        } else if (body.action === "pause" || body.status === "paused") {
            await CampaignService.pauseCampaign(id);
        } else if (body.leadIds) {
            await CampaignService.addLeadsToCampaign(id, body.leadIds, teamId);
        } else {
            const allowedUpdates: Record<string, unknown> = {};
            if (body.name !== undefined) allowedUpdates.name = body.name;
            if (body.description !== undefined) allowedUpdates.description = body.description;
            if (body.status !== undefined) allowedUpdates.status = body.status;
            if (body.targetCount !== undefined) allowedUpdates.targetCount = body.targetCount;
            if (body.completedCount !== undefined) allowedUpdates.completedCount = body.completedCount;

            if (Object.keys(allowedUpdates).length === 0 && body.draftGenerationMode === undefined) {
                throw new APIError("No valid update fields provided", 400, "VALIDATION_ERROR");
            }

            if (Object.keys(allowedUpdates).length > 0) {
                await prisma.campaign.update({
                    where: { id },
                    data: allowedUpdates,
                });
            }
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
