import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";
import { authOptions, canInviteUsers, isSuperAdminRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AuditService } from "@/modules/audit/auditService";
import {
    createInviteToken,
    getInviteLink,
    hashInviteToken,
    INVITE_TTL_MS,
    isAssignableInviteRole,
    maybeSendInviteEmail
} from "@/lib/invitations";

async function getActor() {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;

    return prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true }
    });
}

function getAllowedTeamIds(actor: NonNullable<Awaited<ReturnType<typeof getActor>>>) {
    if (isSuperAdminRole(actor.enterpriseRole)) return null;
    return actor.memberships.filter((member) => member.status === "active").map((member) => member.teamId);
}

export async function GET() {
    const actor = await getActor();
    if (!actor || !canInviteUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const allowedTeamIds = getAllowedTeamIds(actor);
    const invites = await prisma.userInvitation.findMany({
        ...(allowedTeamIds ? { where: { teamId: { in: allowedTeamIds } } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
            team: { select: { id: true, name: true } },
            invitedBy: { select: { id: true, name: true, email: true } }
        }
    });

    return NextResponse.json(invites);
}

export async function POST(req: NextRequest) {
    const actor = await getActor();
    if (!actor || !canInviteUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role : UserRole.SALES_USER;
    const requestedTeamId = typeof body.teamId === "string" ? body.teamId : "";

    if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    if (!isAssignableInviteRole(role)) {
        return NextResponse.json({ error: "Invalid invitation role." }, { status: 400 });
    }

    if (!isSuperAdminRole(actor.enterpriseRole) && (role === UserRole.SUPER_ADMIN || role === UserRole.SYSTEM_ADMIN)) {
        return NextResponse.json({ error: "Only super admins can invite super admins." }, { status: 403 });
    }

    const allowedTeamIds = getAllowedTeamIds(actor);
    const teamId = requestedTeamId || actor.memberships.find((member) => member.status === "active")?.teamId;

    if (!teamId) {
        return NextResponse.json({ error: "A team is required to invite a user." }, { status: 400 });
    }

    if (allowedTeamIds && !allowedTeamIds.includes(teamId)) {
        return NextResponse.json({ error: "Cannot invite users outside your team." }, { status: 403 });
    }

    const token = createInviteToken();
    const inviteLink = getInviteLink(token);
    const invitation = await prisma.userInvitation.create({
        data: {
            email,
            role,
            teamId,
            invitedById: actor.id,
            tokenHash: hashInviteToken(token),
            expiresAt: new Date(Date.now() + INVITE_TTL_MS)
        },
        include: { team: { select: { id: true, name: true } } }
    });

    const existingMember = await prisma.teamMember.findFirst({
        where: { teamId, email }
    });

    const teamRole = role === UserRole.ORG_ADMIN ? "admin" : role === UserRole.VIEWER ? "viewer" : "member";
    if (existingMember) {
        await prisma.teamMember.update({
            where: { id: existingMember.id },
            data: { role: teamRole, status: "invited" }
        });
    } else {
        await prisma.teamMember.create({
            data: { teamId, email, role: teamRole, status: "invited" }
        });
    }

    let emailed = false;
    try {
        emailed = await maybeSendInviteEmail(email, inviteLink);
    } catch (error) {
        console.error("[Invitations] Failed to email invite:", error);
    }

    await AuditService.log(teamId, actor.id, "user_invited", "UserInvitation", invitation.id, {
        email,
        role,
        emailed
    });

    return NextResponse.json({ ...invitation, inviteLink, emailed }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
    const actor = await getActor();
    if (!actor || !canInviteUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";

    if (!id || status !== "revoked") {
        return NextResponse.json({ error: "Only invite revocation is supported." }, { status: 400 });
    }

    const invitation = await prisma.userInvitation.findUnique({ where: { id } });
    if (!invitation) {
        return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    const allowedTeamIds = getAllowedTeamIds(actor);
    if (allowedTeamIds && !allowedTeamIds.includes(invitation.teamId)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.userInvitation.update({
        where: { id },
        data: { status: "revoked" }
    });

    return NextResponse.json(updated);
}
