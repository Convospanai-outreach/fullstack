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
                            // Initialize default settings for the user
                            settings: {
                                create: {
                                    theme: "dark"
                                }
                            }
                        }
                    });
                    // Create a default team for the admin
                    const team = await prisma.team.create({
                        data: {
                            name: "Admin Team",
                            members: {
                                create: {
                                    userId: newUser.id,
                                    email: newUser.email,
                                    role: "owner",
                                    status: "active"
                                }
                            },
                            // Default subscription
                            subscription: {
                                create: {
                                    status: "active",
                                    currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
                                    razorpayPlanId: "pro"
                                }
                            }
                        }
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
            }
            return session;
        },
        jwt: async ({ token, user }) => {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
    },
    events: {
        signIn: async (message) => {
            if (message.user.id && message.user.email) {
                try {
                    const { auditService } = await import("@/modules/audit-logs/service/auditService");
                    await auditService.logLogin(message.user.id, message.user.email);
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
