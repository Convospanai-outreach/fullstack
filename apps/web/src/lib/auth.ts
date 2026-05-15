import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";

import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";

export const authOptions: NextAuthOptions = {
    adapter: PrismaAdapter(prisma as any),
    providers: [
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
                const user = session.user as any;
                const jwt = token as any;
                user.id = jwt.id as string;
                user.name = jwt.name ?? null;
                user.email = jwt.email ?? null;
                user.image = jwt.picture ?? null;
                user.plan = jwt.plan;
                user.productMode = jwt.productMode;
                user.productSurface = jwt.productSurface as any;
                user.enterpriseRole = jwt.enterpriseRole;
            }
            return session;
        },
        jwt: async ({ token, user }) => {
            const jwt = token as any;
            if (user) {
                jwt.id = user.id;
            }

            // Fetch Plan with Redis caching
            if (jwt.id) {
                try {
                    const { safeGet, safeSet } = await import("@/lib/redis");
                    const cacheKey = `user:plan:${jwt.id}`;

                    // Try cache first; safeGet returns string | null
                    const cached = await safeGet(cacheKey);
                    let planName: string;

                    if (cached) {
                        planName = cached;
                    } else {
                        // Cache miss - query DB
                        const dbUser = await prisma.user.findUnique({
                            where: { id: jwt.id as string },
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

                    jwt.plan = planName;

                    // Fetch Product Mode and Enterprise Role
                    const membership = await prisma.teamMember.findFirst({
                        where: { userId: jwt.id as string },
                        include: {
                            team: {
                                include: { organizationPolicy: true }
                            },
                        }
                    });

                    // Fetch User's enterprise role directly
                    const fullUser = await prisma.user.findUnique({
                        where: { id: jwt.id as string },
                        select: { enterpriseRole: true }
                    });

                    // Default to ENTERPRISE_CORE if no policy set
                    jwt.productMode = membership?.team?.organizationPolicy?.productMode || "ENTERPRISE_CORE";
                    jwt.productSurface = membership?.team?.organizationPolicy?.productSurface || "outreach";
                    jwt.enterpriseRole = fullUser?.enterpriseRole || "SALES_USER";

                } catch (error) {
                    console.error("Error fetching user plan/mode for JWT:", error);
                    jwt.plan = "free";
                    jwt.productMode = "ENTERPRISE_CORE";
                    jwt.productSurface = "outreach";
                    jwt.enterpriseRole = "SALES_USER";
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

    // @ts-ignore
    const userId = session.user.id;

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
