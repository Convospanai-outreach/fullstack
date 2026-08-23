import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canManageUsers, isSuperAdminRole } from "@/lib/auth";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";
import { AuditService } from "@/modules/audit/auditService";
import { UserRole } from "@/types/prisma-safe";

type TeamMembership = { teamId: string; status: string };
type AdminActor = {
    id: string;
    enterpriseRole: UserRole | string | null;
    memberships: TeamMembership[];
};
type ManagedUser = AdminActor & {
    email: string | null;
    memberships: TeamMembership[];
};

async function loadPrisma() {
    const { prisma } = await import("@/lib/db");
    return prisma;
}

async function getActor(): Promise<AdminActor | null> {
    const clerkActor = await findOrCreateClerkAppUser();
    if (clerkActor) return clerkActor as AdminActor;

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;
    if (!userId) return null;

    const prisma = await loadPrisma();
    return prisma.user.findUnique({
        where: { id: userId },
        include: { memberships: true }
    }) as Promise<AdminActor | null>;
}

function allowedTeamIds(actor: AdminActor) {
    if (isSuperAdminRole(actor.enterpriseRole)) return null;
    return actor.memberships.filter((member) => member.status === "active").map((member) => member.teamId);
}

export async function GET() {
    const actor = await getActor();
    if (!actor || !canManageUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const prisma = await loadPrisma();
    const teamIds = allowedTeamIds(actor);
    const users = await prisma.user.findMany({
        ...(teamIds ? { where: { memberships: { some: { teamId: { in: teamIds } } } } } : {}),
        orderBy: { createdAt: "desc" },
        include: {
            memberships: {
                include: { team: { select: { id: true, name: true } } }
            }
        }
    });

    return NextResponse.json(users);
}

export async function PATCH(req: NextRequest) {
    const actor = await getActor();
    if (!actor || !canManageUsers(actor.enterpriseRole)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const id = typeof body.id === "string" ? body.id : "";
    const enterpriseRole = typeof body.enterpriseRole === "string" ? body.enterpriseRole : undefined;
    const role = typeof body.role === "string" ? body.role : undefined;
    const status = typeof body.status === "string" ? body.status : undefined;

    if (!id) {
        return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    const prisma = await loadPrisma();
    const target = await prisma.user.findUnique({
        where: { id },
        include: { memberships: true }
    }) as ManagedUser | null;

    if (!target) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    const teamIds = allowedTeamIds(actor);
    const targetTeamIds = target.memberships.map((member) => member.teamId);
    const sharedTeamIds = teamIds ? targetTeamIds.filter((teamId) => teamIds.includes(teamId)) : targetTeamIds;

    if (teamIds && sharedTeamIds.length === 0) {
        return NextResponse.json({ error: "Cannot manage users outside your team." }, { status: 403 });
    }

    if (enterpriseRole && !Object.values(UserRole).includes(enterpriseRole as UserRole)) {
        return NextResponse.json({ error: "Invalid enterpriseRole." }, { status: 400 });
    }

    if (!isSuperAdminRole(actor.enterpriseRole) && (enterpriseRole === UserRole.SUPER_ADMIN || enterpriseRole === UserRole.SYSTEM_ADMIN)) {
        return NextResponse.json({ error: "Only super admins can grant super admin access." }, { status: 403 });
    }

    if (id === actor.id && enterpriseRole && isSuperAdminRole(actor.enterpriseRole) && !isSuperAdminRole(enterpriseRole)) {
        return NextResponse.json({ error: "Cannot remove your own super admin access." }, { status: 400 });
    }

    const data: { role?: string; enterpriseRole?: UserRole } = {};
    if (role && ["user", "admin", "superadmin"].includes(role)) data.role = role;
    if (enterpriseRole) data.enterpriseRole = enterpriseRole as UserRole;

    let updated = target;
    if (Object.keys(data).length > 0) {
        updated = await prisma.user.update({ where: { id }, data, include: { memberships: true } });
        await AuditService.log(sharedTeamIds[0] || target.memberships[0]?.teamId || actor.memberships[0]?.teamId, actor.id, "role_changed", "User", id, {
            role: data.role,
            enterpriseRole: data.enterpriseRole
        });
    }

    if (status === "inactive") {
        await prisma.teamMember.updateMany({
            where: teamIds ? { userId: id, teamId: { in: sharedTeamIds } } : { userId: id },
            data: { status: "inactive" }
        });
        await AuditService.log(sharedTeamIds[0] || target.memberships[0]?.teamId || actor.memberships[0]?.teamId, actor.id, "user_deactivated", "User", id, {
            email: target.email
        });
    }

    return NextResponse.json(updated);
}
