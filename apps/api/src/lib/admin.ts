import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { RequestContext } from "@/lib/requestContext";
import { createHmac, timingSafeEqual } from "crypto";

export interface AdminUserContext {
    id: string;
    role: string;
    enterpriseRole: UserRole;
}

const ADMIN_LEVEL: Record<string, number> = {
    ORG_ADMIN: 1,
    SYSTEM_ADMIN: 2,
    SUPER_ADMIN: 2,
};

async function getUserFromRequest(): Promise<AdminUserContext | null> {
    const request = RequestContext.get()?.request;
    if (!request) return null;

    const token = await getToken({
        req: request as any,
        secret: process.env["NEXTAUTH_SECRET"],
    });
    const signedIdentity = verifyInternalAdminHeaders(request.headers);
    const userId = typeof token?.sub === "string" ? token.sub : signedIdentity?.sub || null;
    if (!userId) return null;

    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, enterpriseRole: true },
    });
}

function verifyInternalAdminHeaders(headers: Headers) {
    const secret = process.env["NEXTAUTH_SECRET"];
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

    try {
        const expectedBuffer = Buffer.from(expected, "hex");
        const actualBuffer = Buffer.from(signature, "hex");
        if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
            return null;
        }
    } catch {
        return null;
    }

    return { sub: userId, email, enterpriseRole: role };
}

export async function getAdminUser(requiredRole: UserRole = UserRole.ORG_ADMIN): Promise<AdminUserContext | null> {
    const userFromRequest = await getUserFromRequest();
    if (userFromRequest) {
        const level = ADMIN_LEVEL[userFromRequest.enterpriseRole] || 0;
        const requiredLevel = ADMIN_LEVEL[requiredRole] || 0;
        return level >= requiredLevel ? userFromRequest : null;
    }

    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return null;
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { id: true, role: true, enterpriseRole: true }
    });

    if (!user) return null;

    const level = ADMIN_LEVEL[user.enterpriseRole] || 0;
    const requiredLevel = ADMIN_LEVEL[requiredRole] || 0;
    return level >= requiredLevel ? user : null;
}

export async function checkAdmin(requiredRole: UserRole = UserRole.ORG_ADMIN) {
    return Boolean(await getAdminUser(requiredRole));
}
