import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

// Campaign.status is a free-form String column; these are the values the app
// actually writes (same list as apps/api routes/campaigns/[id]).
const CAMPAIGN_STATUSES = new Set(["draft", "active", "paused", "completed", "scheduled"]);
const DRAFT_GENERATION_MODES = new Set(["REALTIME", "BATCH"]);

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
        const { campaign, teamId, prisma } = await getCampaignContext(id, TeamRole.VIEWER);

        // Progress of the latest BATCH draft generation, if any (status: submitted | polling | completed | failed).
        // Best-effort: a failure here must not take down the whole campaign detail response.
        const draftBatch = await prisma.aiDraftBatch
            .findFirst({
                where: { campaignId: id, teamId },
                orderBy: { createdAt: "desc" },
                select: { status: true, itemCount: true },
            })
            .catch(() => null);

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
            draftBatch,
        });
    } catch (error: any) {
        const status = error.message === "Unauthorized" ? 401 : error.message === "Campaign not found" ? 404 : 500;
        return NextResponse.json({ error: error.message || "Internal Server Error" }, { status });
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { prisma, teamId, campaign } = await getCampaignContext(id, TeamRole.MEMBER);
        const body = await req.json();

        const { CampaignService } = await import("@/lib/campaignService");

        if (body.action === "start") {
            await CampaignService.startCampaign(id);
        } else if (body.action === "pause" || body.status === "paused") {
            await CampaignService.pauseCampaign(id);
        } else if (body.leadIds) {
            await CampaignService.addLeadsToCampaign(id, body.leadIds, teamId);
        } else {
            const allowedUpdates: Record<string, unknown> = {};
            if (typeof body.name === "string") allowedUpdates["name"] = body.name;
            if (typeof body.description === "string" || body.description === null) {
                allowedUpdates["description"] = body.description;
            }
            if (typeof body.status === "string") {
                if (!CAMPAIGN_STATUSES.has(body.status)) {
                    return NextResponse.json({ error: "Invalid campaign status" }, { status: 400 });
                }
                allowedUpdates["status"] = body.status;
            }
            if (body.draftGenerationMode !== undefined) {
                if (!DRAFT_GENERATION_MODES.has(body.draftGenerationMode)) {
                    return NextResponse.json({ error: "draftGenerationMode must be REALTIME or BATCH" }, { status: 400 });
                }
                // BATCH submits once the enrichment counter seeded at campaign start reaches 0, so the mode
                // can't change after start without stranding in-flight leads.
                if (campaign.status !== "draft") {
                    return NextResponse.json({ error: "Draft generation mode can only be changed before the campaign starts" }, { status: 409 });
                }
                allowedUpdates["draftGenerationMode"] = body.draftGenerationMode;
            }
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
