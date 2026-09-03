import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentContext } from "@/lib/auth";
import { handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        await authorizeRole(userId, teamId, TeamRole.MEMBER);
    } catch (error) {
        return handleAPIError(error);
    }

    const { id } = await params;
    const body = await req.json();
    // Never let the caller reassign a campaign's tenant or identity via mass assignment.
    const { id: _ignoredId, teamId: _ignoredTeamId, ownerId: _ignoredOwnerId, ...allowedData } = body;

    const updated = await prisma.campaign.updateMany({
        where: { id, teamId },
        data: allowedData,
    });
    if (updated.count === 0) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const campaign = await prisma.campaign.findFirst({ where: { id, teamId } });
    return NextResponse.json(campaign);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    try {
        await authorizeRole(userId, teamId, TeamRole.ADMIN);
    } catch (error) {
        return handleAPIError(error);
    }

    const { id } = await params;
    const deleted = await prisma.campaign.deleteMany({ where: { id, teamId } });
    if (deleted.count === 0) {
        return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
}
