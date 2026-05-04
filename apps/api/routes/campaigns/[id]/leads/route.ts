import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

// POST /api/campaigns/[id]/leads - Assign leads to campaign
export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const { leadIds } = body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json(
                { error: "leadIds array is required" },
                { status: 400 }
            );
        }

        const campaign = await prisma.campaign.findFirst({
            where: { id, teamId },
        });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        // Update leads to assign them to this campaign
        await prisma.lead.updateMany({
            where: {
                id: { in: leadIds },
                teamId,
            },
            data: {
                campaignId: id,
            },
        });

        // Get updated lead count
        const leadCount = await prisma.lead.count({
            where: { campaignId: id, teamId },
        });

        return NextResponse.json({ success: true, leadCount });
    } catch (error) {
        console.error("Error assigning leads:", error);
        return NextResponse.json(
            { error: "Failed to assign leads" },
            { status: 500 }
        );
    }
}

// DELETE /api/campaigns/[id]/leads - Remove leads from campaign
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        if (!(await checkTeamPermission(userId, teamId, TeamRole.MEMBER))) {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const { leadIds } = body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json(
                { error: "leadIds array is required" },
                { status: 400 }
            );
        }

        // Update leads to remove them from this campaign
        await prisma.lead.updateMany({
            where: {
                id: { in: leadIds },
                campaignId: id,
                teamId,
            },
            data: {
                campaignId: null,
            },
        });

        // Get updated lead count
        const leadCount = await prisma.lead.count({
            where: { campaignId: id, teamId },
        });

        return NextResponse.json({ success: true, leadCount });
    } catch (error) {
        console.error("Error removing leads:", error);
        return NextResponse.json(
            { error: "Failed to remove leads" },
            { status: 500 }
        );
    }
}
