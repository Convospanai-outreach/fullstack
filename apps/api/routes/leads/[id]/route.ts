import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/auth";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { authorizeRole, TeamRole } from "@/lib/permissions";

async function requireLeadContext(id: string, requiredRole: TeamRole) {
    const { teamId, userId } = await getCurrentContext();
    if (!teamId || !userId) {
        throw new APIError("Unauthorized", 401, "UNAUTHORIZED");
    }

    await authorizeRole(userId, teamId, requiredRole);

    const lead = await prisma.lead.findFirst({
        where: { id, teamId },
        include: {
            campaign: true,
        },
    });

    if (!lead) {
        throw new APIError("Lead not found", 404, "NOT_FOUND");
    }

    return { lead, teamId };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { lead } = await requireLeadContext(id, TeamRole.MEMBER);
        return NextResponse.json(lead);
    } catch (error) {
        return handleAPIError(error);
    }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { teamId } = await requireLeadContext(id, TeamRole.MEMBER);
        const body = await req.json();

        // Prevent sensitive/system field mutation from direct payload pass-through.
        const {
            id: _ignoredId,
            teamId: _ignoredTeamId,
            createdAt: _ignoredCreatedAt,
            updatedAt: _ignoredUpdatedAt,
            ...safeData
        } = body ?? {};

        if (Object.keys(safeData).length === 0) {
            throw new APIError("No valid fields supplied for update", 400, "VALIDATION_ERROR");
        }

        const updateResult = await prisma.lead.updateMany({
            where: { id, teamId },
            data: safeData
        });

        if (updateResult.count !== 1) {
            throw new APIError("Lead not found", 404, "NOT_FOUND");
        }

        const lead = await prisma.lead.findFirst({
            where: { id, teamId },
            include: { campaign: true },
        });

        return NextResponse.json(lead);
    } catch (error) {
        return handleAPIError(error);
    }
}
