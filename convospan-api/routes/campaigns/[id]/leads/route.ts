import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/campaigns/[id]/leads - Assign leads to campaign
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const body = await req.json();
        const { leadIds } = body;

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return NextResponse.json(
                { error: "leadIds array is required" },
                { status: 400 }
            );
        }

        // Update leads to assign them to this campaign
        await prisma.lead.updateMany({
            where: {
                id: { in: leadIds },
            },
            data: {
                campaignId: params.id,
            },
        });

        // Get updated lead count
        const leadCount = await prisma.lead.count({
            where: { campaignId: params.id },
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
    { params }: { params: { id: string } }
) {
    try {
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
                campaignId: params.id,
            },
            data: {
                campaignId: null,
            },
        });

        // Get updated lead count
        const leadCount = await prisma.lead.count({
            where: { campaignId: params.id },
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
