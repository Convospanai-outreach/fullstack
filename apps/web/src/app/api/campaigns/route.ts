import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { createCampaignSchema } from "@/lib/validation/schemas";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await authorizeRole(userId, teamId, TeamRole.VIEWER);
        const { prisma } = await import("@/lib/db");

        const { searchParams } = new URL(req.url);
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

export async function POST(req: Request) {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId || !teamId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        await authorizeRole(userId, teamId, TeamRole.MEMBER);
        const { prisma } = await import("@/lib/db");

        const body = await req.json();

        // Validate input if valid schema
        const validation = createCampaignSchema.safeParse(body);
        const name = validation.success ? validation.data.name : body.name || "Untitled Campaign";
        const description = validation.success ? validation.data.description : body.description || null;
        const targetCount = typeof body.targetCount === "number" ? body.targetCount : 0;
        const leads = body.leads;

        const campaign = await prisma.campaign.create({
            data: {
                teamId,
                ownerId: userId,
                name,
                description,
                targetCount,
                status: "draft",
            },
        });

        // Attach leads if provided
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
