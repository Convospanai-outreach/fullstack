import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { createHmac, timingSafeEqual } from "crypto";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import GoogleProviderImport from "next-auth/providers/google";
import { NextAuthOptions } from "next-auth";
import CredentialsProviderImport from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { RequestContext } from "@/lib/requestContext";

// Conditional Google Provider
const googleClientId = process.env['GOOGLE_CLIENT_ID'];
const googleClientSecret = process.env['GOOGLE_CLIENT_SECRET'];

const providers = [];
const GoogleProvider: typeof import("next-auth/providers/google").default =
    ((GoogleProviderImport as any).default ?? GoogleProviderImport) as any;
const CredentialsProvider: typeof import("next-auth/providers/credentials").default =
    ((CredentialsProviderImport as any).default ?? CredentialsProviderImport) as any;

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
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    });

                    if (!user || !user.password) {
                        throw new Error("Invalid credentials");
                    }

                    const isValid = await compare(credentials.password, user.password);

                    if (!isValid) {
                        throw new Error("Invalid credentials");
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

            if (token.id) {
                try {
                    const { safeGet, safeSet } = await import("@/lib/redis");
                    const cacheKey = `user:context:${token.id}`;

                    // Try cache first
                    const cached = await safeGet(cacheKey);
                    if (cached) {
                        const validated = JSON.parse(cached);
                        token.plan = validated.plan;
                        token.productMode = validated.productMode;
                        token.productSurface = validated.productSurface;
                        token.enterpriseRole = validated.enterpriseRole;
                        return token;
                    }

                    // Cache miss - [P0-3] Combined Prisma Query
                    const userWithContext = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        select: {
                            enterpriseRole: true,
                            subscription: { include: { plan: true } },
                            memberships: {
                                take: 1,
                                include: { team: { include: { organizationPolicy: true } } }
                            }
                        }
                    });

                    const context = {
                        plan: userWithContext?.subscription?.plan?.name || "FREE",
                        productMode: userWithContext?.memberships[0]?.team?.organizationPolicy?.productMode || "ENTERPRISE_CORE",
                        productSurface: userWithContext?.memberships[0]?.team?.organizationPolicy?.productSurface || "outreach",
                        enterpriseRole: userWithContext?.enterpriseRole || "SALES_USER",
                    };

                    token.plan = context.plan;
                    token.productMode = context.productMode;
                    token.productSurface = context.productSurface;
                    token.enterpriseRole = context.enterpriseRole;

                    // Cache for 5 minutes
                    await safeSet(cacheKey, JSON.stringify(context), 300);

                } catch (error) {
                    console.error("Error fetching user context for JWT:", error);
                    token.plan = "FREE";
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
    const request = RequestContext.get()?.request;
    if (request) {
        return getCurrentContextFromRequest(request);
    }

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

    // Fallback: Check if user has multiple teams to avoid silent misrouting
    const memberships = await prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
        take: 2
    });

    if (memberships.length === 0) {
        return { userId, teamId: null };
    }

    if (memberships.length > 1) {
        // [P2-8] Multi-team user but no workspace cookie set - forcing a choice
        const { APIError } = await import("./apiResponse");
        throw new APIError(
            "Multiple teams found. Please specify a workspace in 'convo-workspace-id' cookie.",
            409,
            "WORKSPACE_SELECTION_REQUIRED"
        );
    }

    return { userId, teamId: memberships[0].teamId };
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
    if (!cookieHeader) return null;

    const parts = cookieHeader.split(";").map((part) => part.trim());
    const entry = parts.find((part) => part.startsWith(`${name}=`));
    if (!entry) return null;

    const value = entry.slice(name.length + 1);
    if (!value) return null;

    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
}

function getCookieMap(cookieHeader: string | null): Map<string, string> {
    const cookies = new Map<string, string>();
    if (!cookieHeader) return cookies;

    for (const part of cookieHeader.split(";")) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        const equalsIndex = trimmed.indexOf("=");
        if (equalsIndex <= 0) continue;

        const name = trimmed.slice(0, equalsIndex);
        const rawValue = trimmed.slice(equalsIndex + 1);
        try {
            cookies.set(name, decodeURIComponent(rawValue));
        } catch {
            cookies.set(name, rawValue);
        }
    }

    return cookies;
}

function verifyInternalAuthHeaders(headers: Headers) {
    const secret = process.env['NEXTAUTH_SECRET'];
    if (!secret) return null;

    const userId = headers.get("x-craftmyfunnel-user-id") || "";
    const email = headers.get("x-craftmyfunnel-user-email") || "";
    const role = headers.get("x-craftmyfunnel-user-role") || "";
    const timestamp = headers.get("x-craftmyfunnel-auth-ts") || "";
    const signature = headers.get("x-craftmyfunnel-auth-signature") || "";

    if (!userId || !timestamp || !signature) return null;

    const issuedAt = Number(timestamp);
    if (!Number.isFinite(issuedAt) || Math.abs(Date.now() - issuedAt) > 5 * 60 * 1000) {
        return null;
    }

    const payload = `v1.${timestamp}.${userId}.${email}.${role}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    const actualBuffer = Buffer.from(signature, "hex");

    if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
        return null;
    }

    return { sub: userId, email, enterpriseRole: role };
}

export async function getCurrentContextFromRequest(req: Request) {
    const cookieHeader = req.headers.get("cookie");
    const token = await getToken({
        req: {
            headers: req.headers,
            cookies: getCookieMap(cookieHeader),
        } as any,
        secret: process.env['NEXTAUTH_SECRET'],
    });
    const signedIdentity = verifyInternalAuthHeaders(req.headers);
    const userId = token?.sub || signedIdentity?.sub || null;

    if (!userId) {
        return { userId: null, teamId: null };
    }

    const workspaceId = getCookieValue(cookieHeader, "convo-workspace-id");

    if (workspaceId) {
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

    const memberships = await prisma.teamMember.findMany({
        where: { userId },
        select: { teamId: true },
        take: 2
    });

    if (memberships.length === 0) {
        return { userId, teamId: null };
    }

    if (memberships.length > 1) {
        const { APIError } = await import("./apiResponse");
        throw new APIError(
            "Multiple teams found. Please specify a workspace in 'convo-workspace-id' cookie.",
            409,
            "WORKSPACE_SELECTION_REQUIRED"
        );
    }

    return { userId, teamId: memberships[0].teamId };
}

export const auth = () => getServerSession(authOptions);


