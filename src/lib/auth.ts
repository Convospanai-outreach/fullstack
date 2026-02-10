import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

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
    adapter: PrismaAdapter(prisma),
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

                    // Try cache first
                    let planName = await safeGet(cacheKey);

                    if (!planName) {
                        // Cache miss - query DB
                        const user = await prisma.user.findUnique({
                            where: { id: token.id as string },
                            include: {
                                subscription: {
                                    include: { plan: true }
                                }
                            }
                        });

                        planName = user?.subscription?.plan?.name || "FREE";

                        // Cache for 5 minutes
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
                    token.enterpriseRole = fullUser?.enterpriseRole || "SALES_USER";

                } catch (error) {
                    console.error("Error fetching user plan/mode for JWT:", error);
                    token.plan = "free";
                    token.productMode = "ENTERPRISE_CORE";
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
                        await AuditService.log(
                            membership.teamId,
                            message.user.id,
                            "USER_LOGIN",
                            "Auth",
                            message.user.id,
                            { email: message.user.email }
                        );
                    }
                } catch (e) { console.error("Failed to log login", e) }
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
