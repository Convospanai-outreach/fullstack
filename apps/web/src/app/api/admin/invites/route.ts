import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canInviteUsers, isSuperAdminRole } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";
import { UserRole } from "@/types/prisma-safe";
import {
    createInviteToken,
    getInviteLink,
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

async function loadPrisma() {
    const { prisma } = await import("@/lib/db");
    return prisma;
}

async function getActor(): Promise<AdminActor | null> {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;

    const prisma = await loadPrisma();
    return prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true }
    }) as Promise<AdminActor | null>;
}

function getAllowedTeamIds(actor: AdminActor) {
    if (isSuperAdminRole(actor.enterpriseRole)) return null;
    return actor.memberships.filter((member) => member.status === "active").map((member) => member.teamId);
}

export async function GET() {
    const actor = await getActor();
    if (!actor || !canInviteUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const prisma = await loadPrisma();
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

    // InviteRequest is the platform-wide "request access" waitlist - it has no
    // teamId, so unlike `invites` above it can't be scoped to the caller's own
    // team. ORG_ADMIN is a normal, self-service-assignable per-workspace role
    // (same reasoning as OPEN-124), not a platform-level privilege, so it must
    // not see or act on other companies' pending signup requests.
    const inviteRequests = isSuperAdminRole(actor.enterpriseRole)
        ? await prisma.inviteRequest.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                approvedBy: { select: { id: true, name: true, email: true } },
                invitations: {
                    select: { id: true, status: true, expiresAt: true, acceptedAt: true },
                    orderBy: { createdAt: "desc" },
                    take: 1
                }
            }
        })
        : [];

    return NextResponse.json({ invites, inviteRequests });
}

export async function POST(req: NextRequest) {
    const actor = await getActor();
    if (!actor || !canInviteUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();

    // Bulk path (e.g. the setup wizard's "invite your team" step, which sends
    // several teammates at once): kept separate from the single-email path
    // below rather than merged, so the existing single-invite response shape
    // (a flat invitation object, not a results array) never changes for its
    // existing caller.
    if (Array.isArray(body.emails)) {
        return handleBulkInvite(actor, body);
    }

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

    const prisma = await loadPrisma();
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

async function handleBulkInvite(actor: AdminActor, body: any) {
    const role = typeof body.role === "string" ? body.role : UserRole.SALES_USER;
    const requestedTeamId = typeof body.teamId === "string" ? body.teamId : "";

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

    const emails = Array.from(new Set(
        (body.emails as unknown[])
            .filter((value): value is string => typeof value === "string")
            .map((value) => value.trim().toLowerCase())
            .filter((value) => value.includes("@"))
    ));

    if (emails.length === 0) {
        return NextResponse.json({ error: "At least one valid email is required." }, { status: 400 });
    }

    // A pasted list is an unusually large blast of invite emails compared to the
    // one-at-a-time admin flow above - cap it so a copy-paste mistake (or abuse)
    // can't fan out into an unbounded batch of emails and DB writes.
    if (emails.length > 50) {
        return NextResponse.json({ error: "You can invite up to 50 teammates at a time." }, { status: 400 });
    }

    const prisma = await loadPrisma();
    const teamRole = role === UserRole.ORG_ADMIN ? "admin" : role === UserRole.VIEWER ? "viewer" : "member";

    const results = await Promise.all(emails.map(async (email) => {
        try {
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
                }
            });

            const existingMember = await prisma.teamMember.findFirst({ where: { teamId, email } });
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

            return { email, ok: true as const, inviteLink, emailed };
        } catch (error: any) {
            return { email, ok: false as const, error: error?.message || "Failed to create invite" };
        }
    }));

    return NextResponse.json({ results }, { status: 201 });
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
        // InviteRequest has no teamId (see the GET handler's comment) - gate on
        // genuine platform-level operators, not the self-service ORG_ADMIN role.
        if (!isSuperAdminRole(actor.enterpriseRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!id) {
            return NextResponse.json({ error: "Invite request id is required." }, { status: 400 });
        }

        const prisma = await loadPrisma();
        const updated = await prisma.inviteRequest.update({
            where: { id },
            data: action === "reject-request"
                ? { status: "REJECTED" }
                : { status: "USED", usedAt: new Date() }
        });

        return NextResponse.json(updated);
    }

    if (action === "approve-request") {
        if (!isSuperAdminRole(actor.enterpriseRole)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!id) {
            return NextResponse.json({ error: "Invite request id is required." }, { status: 400 });
        }

        const prisma = await loadPrisma();
        const inviteRequest = await prisma.inviteRequest.findUnique({ where: { id } });
        if (!inviteRequest) {
            return NextResponse.json({ error: "Invite request not found." }, { status: 404 });
        }

        if (!["WAITLISTED", "REJECTED", "APPROVED"].includes(inviteRequest.status)) {
            return NextResponse.json({ error: `Invite request is already ${inviteRequest.status}.` }, { status: 400 });
        }

        const token = createInviteToken();
        const inviteLink = getInviteLink(token);
        const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
        const now = new Date();

        // This app is multi-tenant: approving a public "request access" signup founds
        // that requester their own new company workspace - it must NOT drop them into
        // the approving admin's existing team as a plain member. (That reuse-existing-team
        // behavior previously here was the actual bug: every approved requester silently
        // became a "member" of whichever team happened to approve them, and the codebase's
        // real "new team" path in googleOnboarding.ts's syncGoogleUserToApp was unreachable
        // because this route always created a matching UserInvitation, which that function
        // checks first.) See googleOnboarding.ts's pendingInvitation branch for the accept-side half of
        // this: it grants "owner" specifically when inviteRequestId is set, since that only
        // happens for a founder invite created here, never for an ordinary teammate invite.
        const companyName = (inviteRequest.company || "My Team").trim();
        const teamName = companyName.toLowerCase().endsWith("workspace") ? companyName : `${companyName} Workspace`;

        const invitation = await prisma.$transaction(async (tx: any) => {
            const team = await tx.team.create({ data: { name: teamName } });

            const createdInvite = await tx.userInvitation.create({
                data: {
                    email: inviteRequest.email,
                    role: UserRole.SALES_USER,
                    teamId: team.id,
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

            // Placeholder membership for the founding member, pending acceptance - the
            // real role grant on accept happens in googleOnboarding.ts, this just reserves
            // the row (same pattern the regular teammate-invite POST above already uses).
            await tx.teamMember.create({
                data: { teamId: team.id, email: inviteRequest.email, role: "owner", status: "invited" }
            });

            return createdInvite;
        });

        let emailed = false;
        try {
            emailed = await maybeSendInviteEmail(inviteRequest.email, inviteLink);
        } catch (error) {
            console.error("[Invitations] Failed to email approved invite request:", error);
        }

        await AuditService.log(invitation.team.id, actor.id, "invite_request_approved", "InviteRequest", inviteRequest.id, {
            email: inviteRequest.email,
            invitationId: invitation.id,
            emailed
        });

        return NextResponse.json({ invitation, inviteLink, emailed });
    }

    if (!id || status !== "revoked") {
        return NextResponse.json({ error: "Only invite revocation is supported." }, { status: 400 });
    }

    const prisma = await loadPrisma();
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
