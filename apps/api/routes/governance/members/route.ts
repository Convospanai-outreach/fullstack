import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

export async function GET() {
    try {
        const { userId, teamId } = await getCurrentContext();
        if (!userId) return new NextResponse("Unauthorized", { status: 401 });
        if (!teamId) return new NextResponse("Workspace Not Found", { status: 404 });
        if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
            return new NextResponse("Forbidden", { status: 403 });
        }

        const team = await prisma.team.findUnique({
            where: { id: teamId },
            include: { members: { include: { user: true } } }
        });
        if (!team) {
            return new NextResponse("Workspace Not Found", { status: 404 });
        }

        return NextResponse.json({
            success: true,
            members: team.members,
            teamName: team.name
        });
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logger.error("[Governance API] Failed to fetch team members", { error: errorMessage });
        return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
    }
}
