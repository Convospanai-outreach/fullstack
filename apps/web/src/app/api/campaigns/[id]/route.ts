import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const campaign = await prisma.campaign.findFirst({
            where: { id, teamId },
            include: {
                leadList: {
                    select: {
                        id: true,
                        fullName: true,
                        email: true,
                        company: true,
                        status: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: "desc" },
                },
                _count: { select: { leadList: true } },
            },
        });

        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }

        return NextResponse.json({
            ...campaign,
            leads: campaign.leadList,
        });
    } catch (error: any) {
        console.error("GET /api/campaigns/[id] error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const body = await request.json();
        const { name, description, status, targetCount } = body;

        const updated = await prisma.campaign.updateMany({
            where: { id, teamId },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(status !== undefined && { status }),
                ...(targetCount !== undefined && { targetCount }),
            },
        });

        if (updated.count === 0) {
            return NextResponse.json({ error: "Campaign not found or unauthorized" }, { status: 404 });
        }

        const campaign = await prisma.campaign.findUnique({ where: { id } });
        return NextResponse.json(campaign);
    } catch (error: any) {
        console.error("PATCH /api/campaigns/[id] error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const deleted = await prisma.campaign.deleteMany({
            where: { id, teamId },
        });

        if (deleted.count === 0) {
            return NextResponse.json({ error: "Campaign not found or unauthorized" }, { status: 404 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE /api/campaigns/[id] error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
