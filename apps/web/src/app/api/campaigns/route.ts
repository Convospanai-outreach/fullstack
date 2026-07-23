import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || undefined;
        const search = searchParams.get("search") || undefined;

        const where: any = { teamId };
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
            ];
        }

        const campaigns = await prisma.campaign.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                _count: { select: { leadList: true } },
            },
        });

        return NextResponse.json(campaigns);
    } catch (error: any) {
        console.error("GET /api/campaigns error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { prisma } = await import("@/lib/db");
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { name, description, targetCount, leads } = body;

        const campaign = await prisma.campaign.create({
            data: {
                teamId,
                ownerId: userId,
                name: name || "Untitled Campaign",
                description: description || null,
                targetCount: typeof targetCount === "number" ? targetCount : 0,
                status: "draft",
            },
        });

        // If leads array is provided, attach them to this campaign
        if (Array.isArray(leads) && leads.length > 0) {
            await prisma.lead.updateMany({
                where: { id: { in: leads }, teamId },
                data: { campaignId: campaign.id },
            });
        }

        return NextResponse.json(campaign, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/campaigns error:", error);
        return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
    }
}
