import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let policy = await prisma.organizationPolicy.findUnique({
        where: { organizationId: ctx.teamId }
    });

    if (!policy) {
        // Create default if missing
        policy = await prisma.organizationPolicy.create({
            data: { organizationId: ctx.teamId }
        });
    }

    return NextResponse.json(policy);
}

export async function PATCH(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    const policy = await prisma.organizationPolicy.update({
        where: { organizationId: ctx.teamId },
        data: {
            requiresApprovalForCampaign: body.requiresApprovalForCampaign,
            maxDailyActions: Number(body.maxDailyActions),
            maxCreditsPerUser: Number(body.maxCreditsPerUser)
        }
    });

    return NextResponse.json(policy);
}
