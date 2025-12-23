import { prisma } from "@/lib/db";

import { getServerSession } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";

import CredentialsProvider from "next-auth/providers/credentials";
import { compare, hash } from "bcryptjs";

// Conditional Google Provider
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

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

                // Auto-seed Admin User Logic
                if (!user && credentials.email === "test@test.com" && credentials.password === "passwordadmin") {
                    const hashedPassword = await hash("passwordadmin", 12);
                    const newUser = await prisma.user.create({
                        data: {
                            email: "test@test.com",
                            password: hashedPassword,
                            name: "Test Admin",
                            role: "admin",
                            emailVerified: new Date(),
                        }
                    });

                    await setupUser({
                        id: newUser.id,
                        email: newUser.email,
                        name: newUser.name
                    });

                    return newUser;
                }

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
                session.user.name = token.name;
                session.user.email = token.email;
                session.user.image = token.picture;
                session.user.plan = token.plan;
            }
            return session;
        },
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
            }

            // Fetch Plan on every token refresh (ensures upgrades are reflected relatively quickly)
            if (token.id) {
                try {
                    // Fetch the user's subscription
                    const user = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        include: {
                            subscription: {
                                include: { plan: true }
                            }
                        }
                    });

                    // Extract plan name or default to 'FREE'
                    const planName = user?.subscription?.plan?.name || "FREE";
                    token.plan = planName;
                } catch (error) {
                    console.error("Error fetching user plan for JWT:", error);
                    token.plan = "free"; // Fallback
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

    // Get user's active team (for now, just the first one)
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
