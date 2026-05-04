import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { APIError, handleAPIError } from "@/lib/apiResponse";
import { UserRole } from "@prisma/client";
import { getAdminUser } from "@/lib/admin";
import { audit } from "@/lib/governance/audit";

async function getAuditTeamId(actorId: string, targetId?: string) {
    const membership = await prisma.teamMember.findFirst({
        where: targetId ? { OR: [{ userId: actorId }, { userId: targetId }] } : { userId: actorId },
        orderBy: { createdAt: "asc" },
        select: { teamId: true }
    });
    return membership?.teamId || null;
}

function assertCanAssignRole(actorEnterpriseRole: UserRole, nextRole?: string, nextEnterpriseRole?: UserRole) {
    const grantsSystemAdmin = nextEnterpriseRole === UserRole.SYSTEM_ADMIN || nextRole === "admin";
    if (grantsSystemAdmin && actorEnterpriseRole !== UserRole.SYSTEM_ADMIN) {
        throw new APIError("Forbidden: system admin role changes require system admin access", 403, "FORBIDDEN");
    }
}

// GET: List all users (Admin only)
export async function GET() {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const users = await prisma.user.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                memberships: {
                    include: { team: true }
                }
            }
        });

        return NextResponse.json(users);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

// POST: Create a new user (Admin only)
export async function POST(req: Request) {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { email, name, role, enterpriseRole } = body;

        if (!email) throw new APIError("Email is required", 400, "BAD_REQUEST");

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) throw new APIError("User already exists", 409, "CONFLICT");

        if (role && !["user", "admin"].includes(role)) {
            throw new APIError("Invalid role", 400, "BAD_REQUEST");
        }

        if (enterpriseRole && !Object.values(UserRole).includes(enterpriseRole)) {
            throw new APIError("Invalid enterpriseRole", 400, "BAD_REQUEST");
        }

        const derivedEnterpriseRole =
            enterpriseRole ||
            (role === "admin" ? UserRole.SYSTEM_ADMIN : UserRole.SALES_USER);
        assertCanAssignRole(admin.enterpriseRole, role, derivedEnterpriseRole);

        const newUser = await prisma.user.create({
            data: {
                email,
                name,
                role: role || "user",
                enterpriseRole: derivedEnterpriseRole,
            }
        });

        const auditTeamId = await getAuditTeamId(admin.id, newUser.id);
        if (auditTeamId) {
            await audit({
                actorId: admin.id,
                orgId: auditTeamId,
                action: "ADMIN_USER_CREATED",
                entity: "User",
                entityId: newUser.id,
                metadata: { role: newUser.role, enterpriseRole: newUser.enterpriseRole }
            });
        }

        return NextResponse.json(newUser);
    } catch (error: any) {
        return handleAPIError(error);
    }
}

// PATCH: Update user roles (Admin only)
export async function PATCH(req: Request) {
    try {
        const admin = await getAdminUser();
        if (!admin) {
            throw new APIError("Forbidden: Admin access required", 403, "FORBIDDEN");
        }

        const body = await req.json();
        const { id, role, enterpriseRole } = body;

        if (!id) throw new APIError("User id is required", 400, "BAD_REQUEST");

        const data: Record<string, any> = {};
        if (role) {
            if (!["user", "admin"].includes(role)) {
                throw new APIError("Invalid role", 400, "BAD_REQUEST");
            }
            data.role = role;
        }
        if (enterpriseRole) {
            if (!Object.values(UserRole).includes(enterpriseRole)) {
                throw new APIError("Invalid enterpriseRole", 400, "BAD_REQUEST");
            }
            assertCanAssignRole(admin.enterpriseRole, role, enterpriseRole);
            if (id === admin.id && admin.enterpriseRole === UserRole.SYSTEM_ADMIN && enterpriseRole !== UserRole.SYSTEM_ADMIN) {
                throw new APIError("Cannot remove your own system admin access", 400, "SELF_DEMOTION_BLOCKED");
            }
            data.enterpriseRole = enterpriseRole;
        }
        assertCanAssignRole(admin.enterpriseRole, role, data.enterpriseRole);

        if (Object.keys(data).length === 0) {
            throw new APIError("No valid fields to update", 400, "BAD_REQUEST");
        }

        const updated = await prisma.user.update({
            where: { id },
            data
        });

        const auditTeamId = await getAuditTeamId(admin.id, updated.id);
        if (auditTeamId) {
            await audit({
                actorId: admin.id,
                orgId: auditTeamId,
                action: "ADMIN_USER_ROLE_UPDATED",
                entity: "User",
                entityId: updated.id,
                metadata: { role: data.role, enterpriseRole: data.enterpriseRole }
            });
        }

        return NextResponse.json(updated);
    } catch (error: any) {
        return handleAPIError(error);
    }
}
