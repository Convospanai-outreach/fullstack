import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/admin";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { GmailMailboxService } from "@/lib/gmailMailboxService";

async function resolveTeamId(req: NextRequest, userId: string) {
    const requested = new URL(req.url).searchParams.get("teamId");
    if (requested) {
        const membership = await prisma.teamMember.findFirst({ where: { teamId: requested, userId } });
        if (membership) return requested;
    }
    const membership = await prisma.teamMember.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { teamId: true },
    });
    return membership?.teamId || null;
}

export async function GET(req: NextRequest) {
    try {
        const admin = await getAdminUser();
        if (!admin) throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");

        const teamId = await resolveTeamId(req, admin.id);
        if (!teamId) throw new APIError("Admin is not a member of a team", 400, "TEAM_REQUIRED");

        return NextResponse.json({ url: GmailMailboxService.createConnectUrl(teamId, admin.id) });
    } catch (error: any) {
        return handleAPIError(error);
    }
}

