import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    const campaigns = await prisma.campaign.findMany({
        orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json(campaigns);
}

export async function POST(req: Request) {
    const body = await req.json();
    const { name, audience, ownerId, type, aiConfig } = body;
    const campaign = await prisma.campaign.create({
        data: {
            name,
            audience,
            ownerId,
            type: type || "standard",
            aiConfig: aiConfig || undefined
        },
    });
    return NextResponse.json(campaign);
}
