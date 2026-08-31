import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/auth";

// Activity has no teamId of its own - it's only reachable via campaign.teamId,
// so both handlers below must join through the campaign relation to stay
// tenant-scoped instead of reading/writing every team's activity feed.

export async function GET() {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const activities = await prisma.activity.findMany({
        where: { campaign: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 100
    });
    return NextResponse.json(activities);
}

export async function POST(req: Request) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { type, message, meta, campaignId, agentId } = body;

    if (campaignId) {
        const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId } });
        if (!campaign) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }
    }

    const created = await prisma.activity.create({
        data: { type, message, meta, campaignId: campaignId || undefined, agentId: agentId || undefined }
    });
    return NextResponse.json(created);
}
