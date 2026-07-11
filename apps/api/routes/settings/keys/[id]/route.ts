import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { audit } from "@/lib/governance/audit";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const revoked = await prisma.apiKey.updateMany({
        where: { id, teamId: ctx.teamId, isActive: true },
        data: { isActive: false }
    });

    if (revoked.count !== 1) {
        return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    await audit({
        actorId: ctx.userId,
        orgId: ctx.teamId,
        action: "API_KEY_REVOKED",
        entity: "ApiKey",
        entityId: id,
        metadata: {}
    });

    return NextResponse.json({ success: true });
}
