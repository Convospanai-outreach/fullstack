import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

// Ensure ENCRYPTION_KEY is set to a secure, non-default value at runtime
if (!process.env['CI'] && !process.env['GITHUB_ACTIONS']) {
  if (!process.env['ENCRYPTION_KEY'] || process.env['ENCRYPTION_KEY'] === '0123456789abcdef0123456789abcdef') {
    throw new Error('FATAL: ENCRYPTION_KEY must be set to a unique 32‑char hex value');
  }
}

import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import type { JWT } from "next-auth/jwt";

import { redirect } from "next/navigation";
import { UserRole } from "@/types/prisma-safe";
import { findOrCreateClerkAppUser } from "@/lib/clerkAuth";

const DEFAULT_PLAN = "free";
const DEFAULT_PRODUCT_MODE = "ENTERPRISE_CORE";
const DEFAULT_PRODUCT_SURFACE = "outreach";
const DEFAULT_ENTERPRISE_ROLE = "SALES_USER";
const CLAIMS_REFRESH_MS = 5 * 60 * 1000;

function applyDefaultClaims(token: JWT) {
    token.plan = DEFAULT_PLAN;
    token.productMode = DEFAULT_PRODUCT_MODE;
    token.productSurface = DEFAULT_PRODUCT_SURFACE;
    token.enterpriseRole = DEFAULT_ENTERPRISE_ROLE;
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma as any),
    // Clerk is the primary signup/sign-in provider. NextAuth is retained for
    // legacy JWT/session compatibility only, so it intentionally exposes no
    // direct OAuth or password providers.
    providers: [],
    callbacks: {
        signIn: async ({ user }) => {
            if (!user.email) {
                return false;
            }

            const existingUser = await prisma.user.findUnique({
                where: { email: user.email },
                select: { id: true }
            });

            return Boolean(existingUser);
        },
        session: async ({ session, token }) => {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.name = token.name ?? null;
                session.user.email = token.email ?? null;
                session.user.image = token.picture ?? null;
                session.user.plan = token.plan;
                session.user.productMode = token.productMode;
                session.user.productSurface = token.productSurface as any;
                session.user.enterpriseRole = token.enterpriseRole;
            }
            return session;
        },
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
                token.claimsRefreshedAt = 0;
            }

            if (token.id) {
                const claimsAreFresh =
                    typeof token.claimsRefreshedAt === "number" &&
                    Date.now() - token.claimsRefreshedAt < CLAIMS_REFRESH_MS &&
                    typeof token.plan === "string" &&
                    typeof token.productMode === "string" &&
                    typeof token.productSurface === "string" &&
                    typeof token.enterpriseRole === "string";

                if (claimsAreFresh) {
                    return token;
                }

                try {
                    const { safeGet, safeSet } = await import("@/lib/redis");
                    const cacheKey = `user:plan:${token.id}`;

                    const cached = await safeGet(cacheKey);
                    let planName: string;

                    if (cached) {
                        planName = cached;
                    } else {
                        const dbUser = await prisma.user.findUnique({
                            where: { id: token.id as string },
                            include: {
                                subscription: {
                                    include: { plan: true }
                                }
                            }
                        });

                        planName = dbUser?.subscription?.plan?.name ?? "FREE";

                        // Cache for 5 minutes — planName is guaranteed string here
                        await safeSet(cacheKey, planName, 300);
                    }

                    token.plan = planName;

                    const membership = await prisma.teamMember.findFirst({
                        where: { userId: token.id as string },
                        include: {
                            team: {
                                include: { organizationPolicy: true }
                            },
                        }
                    });

                    const fullUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { enterpriseRole: true }
                    });

                    // Default to ENTERPRISE_CORE if no policy set
                    token.productMode = membership?.team?.organizationPolicy?.productMode || DEFAULT_PRODUCT_MODE;
                    token.productSurface = membership?.team?.organizationPolicy?.productSurface || DEFAULT_PRODUCT_SURFACE;
                    token.enterpriseRole = fullUser?.enterpriseRole || DEFAULT_ENTERPRISE_ROLE;
                    token.claimsRefreshedAt = Date.now();

                } catch (error) {
                    console.error("Error fetching user plan/mode for JWT:", error);
                    applyDefaultClaims(token as JWT);
                    token.claimsRefreshedAt = Date.now();
                }
            } else {
                applyDefaultClaims(token as JWT);
            }
            return token;
        },
    },
    events: {
        signIn: async (message) => {
            if (message.user.id && message.user.email) {
                try {
                    const { AuditService } = await import("@/modules/audit/auditService");

                    // Fetch user's team for logging context
                    const membership = await prisma.teamMember.findFirst({
                        where: { userId: message.user.id }
                    });

                    if (membership) {
                        try {
                            await AuditService.log(
                                membership.teamId,
                                message.user.id,
                                "USER_LOGIN",
                                "Auth",
                                message.user.id,
                                { email: message.user.email }
                            );
                        } catch (logError) {
                            console.error("Audit logging failed during login:", logError);
                        }
                    }
                } catch (e) { console.error("Failed to load AuditService during login", e) }
            }
        },
        signOut: async (message) => {
            if (message.token?.id && message.token?.email) {
                try {
                    const { AuditService } = await import("@/modules/audit/auditService");
                    const membership = await prisma.teamMember.findFirst({
                        where: { userId: message.token.id as string }
                    });
                    if (membership) {
                        await AuditService.log(
                            membership.teamId,
                            message.token.id as string,
                            "USER_LOGOUT",
                            "Auth",
                            message.token.id as string,
                            { email: message.token.email }
                        ).catch((e: unknown) => console.error("Audit log failed on logout", e));
                    }
                } catch (e) { console.error("Failed to load AuditService during logout", e); }
            }
        },
    },
    session: {
        strategy: "jwt"
    },
    pages: {
        signIn: "/login",
    },
};

export async function setupUser(user: { id: string, email: string, name?: string | null }) {
    // Initialize default settings for the user
    await prisma.settings.upsert({
        where: { userId: user.id },
        update: {},
        create: {
            userId: user.id,
            theme: "dark"
        }
    });

    // Create a default team for the user if they don't have one
    const existingMembership = await prisma.teamMember.findFirst({
        where: { userId: user.id }
    });

    if (!existingMembership) {
        const teamName = user.name ? `${user.name}'s Team` : "My Team";
        await prisma.team.create({
            data: {
                name: teamName,
                members: {
                    create: {
                        userId: user.id,
                        email: user.email,
                        role: "owner",
                        status: "active"
                    }
                }
            }
        });
    }
}

export async function getCurrentContext() {
    const clerkUser = await findOrCreateClerkAppUser();
    if (clerkUser) {
        const cookieStore = await cookies();
        const workspaceId = cookieStore.get("convo-workspace-id")?.value;
        if (workspaceId) {
            const membership = clerkUser.memberships.find((member) => member.teamId === workspaceId && member.status === "active");
            if (membership) return { userId: clerkUser.id, teamId: workspaceId };
        }

        const activeMemberships = clerkUser.memberships.filter((member) => member.status === "active");
        return { userId: clerkUser.id, teamId: activeMemberships[0]?.teamId || null };
    }

    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return { userId: null, teamId: null };
    }

    const userId = (session.user as { id: string }).id;

    // Check for workspace cookie
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("convo-workspace-id")?.value;

    if (workspaceId) {
        // Verify membership
        const membership = await prisma.teamMember.findFirst({
            where: {
                userId,
                teamId: workspaceId
            }
        });

        if (membership) {
            return { userId, teamId: workspaceId };
        }
    }

    // Fallback: Get user's first active team
    const membership = await prisma.teamMember.findFirst({
        where: { userId },
        select: { teamId: true }
    });

    // If no team, create a default one (onboarding logic)
    if (!membership) {
        return { userId, teamId: null };
    }

    return { userId, teamId: membership.teamId };
}

export const auth = () => getServerSession(authOptions);

export const SUPER_ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.SYSTEM_ADMIN] as const;

export type AuthenticatedUser = {
    id: string;
    email: string;
    name: string | null;
    role: string;
    enterpriseRole: UserRole;
    memberships: {
        id: string;
        teamId: string;
        role: string;
        status: string;
    }[];
};

export async function requireAuth(): Promise<AuthenticatedUser> {
    const clerkUser = await findOrCreateClerkAppUser();
    if (clerkUser) {
        const user = await prisma.user.findUnique({
            where: { id: clerkUser.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                enterpriseRole: true,
                memberships: {
                    select: {
                        id: true,
                        teamId: true,
                        role: true,
                        status: true
                    }
                }
            }
        });

        if (!user) redirect("/login");
        return user;
    }

    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
        redirect("/login");
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            email: true,
            name: true,
            role: true,
            enterpriseRole: true,
            memberships: {
                select: {
                    id: true,
                    teamId: true,
                    role: true,
                    status: true
                }
            }
        }
    });

    if (!user) {
        redirect("/login");
    }

    return user;
}

export async function requireRole(roles: UserRole[]): Promise<AuthenticatedUser> {
    const user = await requireAuth();
    if (!roles.includes(user.enterpriseRole)) {
        redirect("/dashboard");
    }
    return user;
}

export function isSuperAdminRole(role: UserRole | string | null | undefined) {
    return role === UserRole.SUPER_ADMIN || role === UserRole.SYSTEM_ADMIN;
}

export function canManageUsers(role: UserRole | string | null | undefined) {
    return isSuperAdminRole(role) || role === UserRole.ORG_ADMIN;
}

export function canAccessCMS(role: UserRole | string | null | undefined) {
    return canManageUsers(role) || role === UserRole.CMS_EDITOR;
}

export function canInviteUsers(role: UserRole | string | null | undefined) {
    return canManageUsers(role);
}
