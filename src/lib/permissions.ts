import { prisma } from "@/lib/db";

export enum TeamRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member",
    VIEWER = "viewer"
}

const ROLE_HIERARCHY = {
    [TeamRole.OWNER]: 4,
    [TeamRole.ADMIN]: 3,
    [TeamRole.MEMBER]: 2,
    [TeamRole.VIEWER]: 1
};

export async function getTeamRole(userId: string, teamId: string): Promise<TeamRole | null> {
    const member = await prisma.teamMember.findFirst({
        where: { userId, teamId },
        select: { role: true }
    });
    return (member?.role as TeamRole) || null;
}

export async function checkTeamPermission(userId: string, teamId: string, requiredRole: TeamRole): Promise<boolean> {
    const role = await getTeamRole(userId, teamId);
    if (!role) return false;

    const userLevel = ROLE_HIERARCHY[role] || 0;
    const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;

    return userLevel >= requiredLevel;
}

/**
 * Throws an APIError if the user does not have the required role level
 */
export async function authorizeRole(userId: string, teamId: string, requiredRole: TeamRole) {
    const hasPerm = await checkTeamPermission(userId, teamId, requiredRole);
    if (!hasPerm) {
        const { APIError } = await import("@/lib/apiResponse");
        throw new APIError("Insufficient permissions", 403);
    }
}

export function canManageMembers(role: string): boolean {
    // @ts-ignore
    return (ROLE_HIERARCHY[role] || 0) >= ROLE_HIERARCHY[TeamRole.ADMIN];
}

export function canManageBilling(role: string): boolean {
    return role === TeamRole.OWNER;
}
