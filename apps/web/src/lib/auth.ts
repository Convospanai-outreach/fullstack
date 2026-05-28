import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

// Ensure ENCRYPTION_KEY is set to a secure, non-default value
if (!process.env['ENCRYPTION_KEY'] || process.env['ENCRYPTION_KEY'] === '0123456789abcdef0123456789abcdef') {
  throw new Error('FATAL: ENCRYPTION_KEY must be set to a unique 32‑char hex value');
}

import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";

import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

// Conditional Google Provider
const googleClientId = process.env['GOOGLE_CLIENT_ID'];
const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

const providers = [];

if (googleClientId && googleClientSecret) {
    providers.push(
        GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
        })
    );
}

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma as any),
    providers: [
        ...providers,
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error("Invalid credentials");
                }

                try {
                    const { checkRateLimit } = await import("@/lib/rateLimit");
                    const rateLimitKey = `login:${credentials.email}`;
                    const { allowed } = await checkRateLimit(rateLimitKey, { maxRequests: 5, windowMs: 900 * 1000 }, "login");
                    if (!allowed) {
                        throw new Error("Too many login attempts. Please try again in 15 minutes.");
                    }
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    });

                    if (!user || !user.password) {
                        throw new Error("User not found or password not set");
                    }

                    const isValid = await compare(credentials.password, user.password);

                    if (!isValid) {
                        throw new Error("Invalid password");
                    }

                    return user;
                } catch (error: any) {
                    console.error("[Auth] Authorize Fallback Failure:", error.message);
                    throw new Error("Authentication service temporarily unavailable. Please try again later.");
                }
            }
        })
    ],
    callbacks: {
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
            }

            // Fetch Plan with Redis caching
            if (token.id) {
                try {
                    const { safeGet, safeSet } = await import("@/lib/redis");
                    const cacheKey = `user:plan:${token.id}`;

                    // Try cache first; safeGet returns string | null
                    const cached = await safeGet(cacheKey);
                    let planName: string;

                    if (cached) {
                        planName = cached;
                    } else {
                        // Cache miss - query DB
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

                    // Fetch Product Mode and Enterprise Role
                    const membership = await prisma.teamMember.findFirst({
                        where: { userId: token.id as string },
                        include: {
                            team: {
                                include: { organizationPolicy: true }
                            },
                        }
                    });

                    // Fetch User's enterprise role directly
                    const fullUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: { enterpriseRole: true }
                    });

                    // Default to ENTERPRISE_CORE if no policy set
                    token.productMode = membership?.team?.organizationPolicy?.productMode || "ENTERPRISE_CORE";
                    token.productSurface = membership?.team?.organizationPolicy?.productSurface || "outreach";
                    token.enterpriseRole = fullUser?.enterpriseRole || "SALES_USER";

                } catch (error) {
                    console.error("Error fetching user plan/mode for JWT:", error);
                    token.plan = "free";
                    token.productMode = "ENTERPRISE_CORE";
                    token.productSurface = "outreach";
                    token.enterpriseRole = "SALES_USER";
                }
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
