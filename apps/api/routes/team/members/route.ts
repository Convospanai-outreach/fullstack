import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { TeamRole, checkTeamPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const INVITABLE_ROLES = new Set<string>([TeamRole.MEMBER, TeamRole.VIEWER, TeamRole.ADMIN]);

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    const members = await prisma.teamMember.findMany({
        where: { teamId: ctx.teamId },
        include: { user: { select: { name: true, image: true } } }
    });

    return NextResponse.json({ success: true, data: members });
}

// Invite Member (Mock for now or simple DB insert)
export async function POST(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });

    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ success: false, error: "Insufficient permissions" }, { status: 403 });
    }

    const { email, role } = await req.json();
    const requestedRole = role || TeamRole.MEMBER;
    if (typeof email !== "string" || !email.includes("@")) {
        return NextResponse.json({ success: false, error: "Valid email is required" }, { status: 400 });
    }
    if (!INVITABLE_ROLES.has(requestedRole)) {
        return NextResponse.json({ success: false, error: "Invalid role" }, { status: 400 });
    }
    if (requestedRole === TeamRole.ADMIN && !await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.OWNER)) {
        return NextResponse.json({ success: false, error: "Only owners can invite admins" }, { status: 403 });
    }

    const existing = await prisma.teamMember.findFirst({
        where: { teamId: ctx.teamId, email }
    });

    if (existing) return NextResponse.json({ success: false, error: "User already in team" }, { status: 400 });

    const member = await prisma.teamMember.create({
        data: {
            teamId: ctx.teamId,
            email,
            role: requestedRole,
            status: 'invited'
        }
    });

    // Task: Record event for notification/email worker
    const { EventStore, SystemEventType } = await import("@/modules/learning/EventStore");
    await EventStore.record({
        type: SystemEventType.SYSTEM,
        name: "TEAM_INVITE_SENT",
        teamId: ctx.teamId,
        actorId: ctx.userId,
        payload: {
            inviteeEmail: email,
            role: requestedRole,
            memberId: member.id
        }
    });

    return NextResponse.json({ success: true, data: member });
}
