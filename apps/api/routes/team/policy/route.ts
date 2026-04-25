import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.MEMBER)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

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
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const maxDailyActions = Number(body.maxDailyActions);
    const maxCreditsPerUser = Number(body.maxCreditsPerUser);

    if (!Number.isFinite(maxDailyActions) || maxDailyActions < 0) {
        return NextResponse.json({ error: "Invalid maxDailyActions" }, { status: 400 });
    }
    if (!Number.isFinite(maxCreditsPerUser) || maxCreditsPerUser < 0) {
        return NextResponse.json({ error: "Invalid maxCreditsPerUser" }, { status: 400 });
    }

    const policy = await prisma.organizationPolicy.update({
        where: { organizationId: ctx.teamId },
        data: {
            requiresApprovalForCampaign: body.requiresApprovalForCampaign,
            maxDailyActions,
            maxCreditsPerUser
        }
    });

    return NextResponse.json(policy);
}
