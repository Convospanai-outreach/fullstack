import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

import { redirect } from "next/navigation";
import { UserRole } from "@/types/prisma-safe";
import { isSsoEnforcedForEmail } from "@/lib/sso/oidc";
import { syncGoogleUserToApp } from "@/lib/googleOnboarding";

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
    // Google is the sole sign-in provider (Clerk removed). Signup is open:
    // any verified Google account without a matching invite gets its own
    // new team - see syncGoogleUserToApp in @/lib/googleOnboarding.
    providers: [
        GoogleProvider({
            clientId: process.env["GOOGLE_CLIENT_ID"]!,
            clientSecret: process.env["GOOGLE_CLIENT_SECRET"]!,
            // NextAuth's callback handler independently re-checks for a linked
            // Account row and throws OAuthAccountNotLinked before ever consulting
            // the signIn callback's manual `user.id` override below - this is what
            // blocked every pre-Google-era (former Clerk) user from signing back
            // in. Safe here: Google is the sole provider and the signIn callback
            // already gates on email_verified before any linking happens.
            allowDangerousEmailAccountLinking: true,
        }),
    ],
    callbacks: {
        signIn: async ({ user, profile }) => {
            // Only trust addresses Google has actually verified.
            const googleProfile = profile as { email_verified?: boolean; name?: string } | undefined;
            if (!user.email || googleProfile?.email_verified !== true) {
                return false;
            }

            const email = user.email.toLowerCase();

            const existingUser = await prisma.user.findUnique({
                where: { email },
                select: { id: true }
            });

            if (existingUser) {
                if (await isSsoEnforcedForEmail(email)) {
                    return "/login?error=sso-required";
                }
                // Pre-setting user.id makes NextAuth's adapter skip createUser()
                // and go straight to linkAccount(), attaching this Google account
                // to the existing row instead of creating a duplicate user - this
                // is what lets pre-Google-era users sign in with no migration step.
                (user as { id?: string }).id = existingUser.id;
                return true;
            }

            // Carries the invite token from the signup page's short-lived
            // cookie - see (marketing)/signup/page.tsx.
            const cookieStore = await cookies();
            const inviteToken = cookieStore.get("cmf-invite-token")?.value;

            const createdUser = await syncGoogleUserToApp({
                email,
                name: googleProfile?.name || user.name || null,
                inviteToken,
            });

            if (!createdUser) {
                // Only reachable via SSO enforcement on a brand-new email - signup
                // itself is open, syncGoogleUserToApp never denies for lack of an invite.
                return "/login?error=sso-required";
            }

            (user as { id?: string }).id = createdUser.id;
            return true;
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
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
        return { userId: null, teamId: null };
    }

    const userId = (session.user as { id: string }).id;

    // Check for workspace cookie
    const cookieStore = await cookies();
    const workspaceId = cookieStore.get("convo-workspace-id")?.value;

    if (workspaceId) {
        // Verify membership. Status must be checked too: deactivated and
        // invited-but-not-joined rows keep their userId, so matching on
        // userId alone would still grant team context.
        const membership = await prisma.teamMember.findFirst({
            where: {
                userId,
                teamId: workspaceId,
                status: "active"
            }
        });

        if (membership) {
            return { userId, teamId: workspaceId };
        }
    }

    // Fallback: Get user's first active team. Ordered so the implicit default
    // team is stable across requests rather than arbitrary row order.
    const membership = await prisma.teamMember.findFirst({
        where: { userId, status: "active" },
        orderBy: { createdAt: "asc" },
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
