import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";

// Chrome extension settings for the team. autoEnrichCapturedLeads: a lead the extension saves
// is queued for enrichment (email finder, Crystal, scoring - 1 credit) automatically.
export async function GET(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { autoEnrichCapturedLeads: true } });
    return NextResponse.json({ autoEnrichCapturedLeads: team?.autoEnrichCapturedLeads ?? true });
}

// Spends team credits when on, so only an admin can change it.
export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!await checkTeamPermission(userId, teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Only a team admin can change this." }, { status: 403 });
    }
    const body = await req.json().catch(() => null);
    if (typeof body?.autoEnrichCapturedLeads !== "boolean") {
        return NextResponse.json({ error: "autoEnrichCapturedLeads must be true or false." }, { status: 400 });
    }
    const team = await prisma.team.update({
        where: { id: teamId },
        data: { autoEnrichCapturedLeads: body.autoEnrichCapturedLeads },
        select: { autoEnrichCapturedLeads: true },
    });
    return NextResponse.json(team);
}
