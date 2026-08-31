import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/auth";

export async function GET() {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const campaigns = await prisma.campaign.findMany({
        where: { teamId },
        orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, audience, type, aiConfig } = body;
    const campaign = await prisma.campaign.create({
        data: {
            name,
            audience,
            ownerId: userId,
            teamId,
            type: type || "standard",
            aiConfig: aiConfig || undefined
        },
    });
    return NextResponse.json(campaign);
}
