import { prisma } from "@/lib/db";

export enum TeamRole {
    OWNER = "owner",
    ADMIN = "admin",
    MEMBER = "member",
    VIEWER = "viewer"
}

const ROLE_HIERARCHY: Record<TeamRole, number> = {
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

export enum Permission {
    MANAGE_POLICY = "manage_policy",
    RESOLVE_APPROVALS = "resolve_approvals",
    VIEW_AUDIT = "view_audit",
    INVITE_MEMBERS = "invite_members",
    MANAGE_BILLING = "manage_billing",
    MANAGE_PLAYBOOKS = "manage_playbooks",
    MANAGE_SSO = "manage_sso"
}

const ROLE_PERMISSIONS: Record<TeamRole, Permission[]> = {
    [TeamRole.OWNER]: Object.values(Permission),
    [TeamRole.ADMIN]: [
        Permission.MANAGE_POLICY,
        Permission.RESOLVE_APPROVALS,
        Permission.VIEW_AUDIT,
        Permission.INVITE_MEMBERS,
        Permission.MANAGE_PLAYBOOKS,
        Permission.MANAGE_SSO
    ],
    [TeamRole.MEMBER]: [
        Permission.MANAGE_PLAYBOOKS
    ],
    [TeamRole.VIEWER]: []
};

export async function hasPermission(userId: string, teamId: string, permission: Permission): Promise<boolean> {
    const role = await getTeamRole(userId, teamId);
    if (!role) return false;

    return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Throws an APIError if the user does not have the required permission
 */
export async function authorizePermission(userId: string, teamId: string, permission: Permission) {
    const allowed = await hasPermission(userId, teamId, permission);
    if (!allowed) {
        const { APIError } = await import("@/lib/apiResponse");
        throw new APIError(`Insufficient permissions: Requires ${permission}`, 403);
    }
}

export async function authorizeRole(userId: string, teamId: string, requiredRole: TeamRole) {
    const hasPerm = await checkTeamPermission(userId, teamId, requiredRole);
    if (!hasPerm) {
        const { APIError } = await import("@/lib/apiResponse");
        throw new APIError("Insufficient permissions", 403);
    }
}

export function canManageMembers(role: string): boolean {
    if (!Object.values(TeamRole).includes(role as TeamRole)) return false;
    return ROLE_PERMISSIONS[role as TeamRole].includes(Permission.INVITE_MEMBERS);
}



// --- ENTERPRISE RBAC HELPERS ---

import { UserRole } from "@prisma/client";

export function isCaller(role: UserRole): boolean {
    return role === UserRole.CALLER;
}

export function isComplianceOfficer(role: UserRole): boolean {
    return role === UserRole.COMPLIANCE_OFFICER;
}

export function canExportData(role: UserRole): boolean {
    // Callers cannot export data
    if (role === UserRole.CALLER) return false;
    return true;
}

export function canManageSystem(role: UserRole): boolean {
    return role === UserRole.SYSTEM_ADMIN || role === UserRole.ORG_ADMIN;
}
