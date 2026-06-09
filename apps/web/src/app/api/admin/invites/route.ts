import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { clerkClient } from "@clerk/nextjs/server";
import { authOptions, canInviteUsers, isSuperAdminRole } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { prisma } from "@/lib/db";
import { AuditService } from "@/modules/audit/auditService";
import { UserRole } from "@/types/prisma-safe";
import {
    createInviteToken,
    getInviteLink,
    getAppBaseUrl,
    hashInviteToken,
    INVITE_TTL_MS,
    isAssignableInviteRole,
    maybeSendInviteEmail
} from "@/lib/invitations";

type AdminActor = {
    id: string;
    enterpriseRole: UserRole | string | null;
    memberships: Array<{ teamId: string; status: string }>;
};

async function getActor(): Promise<AdminActor | null> {
    const clerkActor = await findOrCreateClerkAppUser();
    if (clerkActor) return clerkActor as AdminActor;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;

    return prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true }
    }) as Promise<AdminActor | null>;
}

function getAllowedTeamIds(actor: AdminActor) {
    if (isSuperAdminRole(actor.enterpriseRole)) return null;
    return actor.memberships.filter((member) => member.status === "active").map((member) => member.teamId);
}

async function maybeSendClerkInvite(email: string, inviteRequestId: string) {
    if (!process.env["CLERK_SECRET_KEY"]) return false;

    const client = await clerkClient();
    await client.invitations.createInvitation({
        emailAddress: email,
        redirectUrl: `${getAppBaseUrl()}/signup`,
        publicMetadata: { inviteRequestId }
    });

    return true;
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
            invitedBy: { select: { id: true, name: true, email: true } },
            inviteRequest: { select: { id: true, name: true, company: true } }
        }
    });

    const inviteRequests = await prisma.inviteRequest.findMany({
        orderBy: { createdAt: "desc" },
        include: {
            approvedBy: { select: { id: true, name: true, email: true } },
            invitations: {
                select: { id: true, status: true, expiresAt: true, acceptedAt: true },
                orderBy: { createdAt: "desc" },
                take: 1
            }
        }
    });

    return NextResponse.json({ invites, inviteRequests });
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
    const action = typeof body.action === "string" ? body.action : "";
    const id = typeof body.id === "string" ? body.id : "";
    const status = typeof body.status === "string" ? body.status : "";

    if (action === "reject-request" || action === "mark-used-request") {
        if (!id) {
            return NextResponse.json({ error: "Invite request id is required." }, { status: 400 });
        }

        const updated = await prisma.inviteRequest.update({
            where: { id },
            data: action === "reject-request"
                ? { status: "REJECTED" }
                : { status: "USED", usedAt: new Date() }
        });

        return NextResponse.json(updated);
    }

    if (action === "approve-request") {
        if (!id) {
            return NextResponse.json({ error: "Invite request id is required." }, { status: 400 });
        }

        const inviteRequest = await prisma.inviteRequest.findUnique({ where: { id } });
        if (!inviteRequest) {
            return NextResponse.json({ error: "Invite request not found." }, { status: 404 });
        }

        if (!["WAITLISTED", "REJECTED", "APPROVED"].includes(inviteRequest.status)) {
            return NextResponse.json({ error: `Invite request is already ${inviteRequest.status}.` }, { status: 400 });
        }

        const allowedTeamIds = getAllowedTeamIds(actor);
        let teamId = actor.memberships.find((member) => member.status === "active")?.teamId;
        if (!teamId && !allowedTeamIds) {
            teamId = (await prisma.team.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } }))?.id;
        }

        if (!teamId) {
            return NextResponse.json({ error: "A team is required before approving invite requests." }, { status: 400 });
        }

        if (allowedTeamIds && !allowedTeamIds.includes(teamId)) {
            return NextResponse.json({ error: "Cannot approve invite requests outside your team." }, { status: 403 });
        }

        const token = createInviteToken();
        const inviteLink = getInviteLink(token);
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
        const now = new Date();

        const invitation = await prisma.$transaction(async (tx: any) => {
            const createdInvite = await tx.userInvitation.create({
                data: {
                    email: inviteRequest.email,
                    role: UserRole.SALES_USER,
                    teamId,
                    invitedById: actor.id,
                    tokenHash: hashInviteToken(token),
                    expiresAt,
                    inviteRequestId: inviteRequest.id
                },
                include: { team: { select: { id: true, name: true } } }
            });

            await tx.inviteRequest.update({
                where: { id: inviteRequest.id },
                data: {
                    status: "INVITED",
                    inviteToken: token,
                    approvedById: actor.id,
                    approvedAt: now
                }
            });

            const existingMember = await tx.teamMember.findFirst({
                where: { teamId, email: inviteRequest.email }
            });

            if (existingMember) {
                await tx.teamMember.update({
                    where: { id: existingMember.id },
                    data: { role: "member", status: "invited" }
                });
            } else {
                await tx.teamMember.create({
                    data: { teamId, email: inviteRequest.email, role: "member", status: "invited" }
                });
            }

            return createdInvite;
        });

        let emailed = false;
        let clerkInvited = false;
        try {
            clerkInvited = await maybeSendClerkInvite(inviteRequest.email, inviteRequest.id);
            if (!clerkInvited) {
                emailed = await maybeSendInviteEmail(inviteRequest.email, inviteLink);
            }
        } catch (error) {
            console.error("[Invitations] Failed to email approved invite request:", error);
        }

        await AuditService.log(teamId, actor.id, "invite_request_approved", "InviteRequest", inviteRequest.id, {
            email: inviteRequest.email,
            invitationId: invitation.id,
            emailed,
            clerkInvited
        });

        return NextResponse.json({ invitation, inviteLink, emailed, clerkInvited });
    }

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
