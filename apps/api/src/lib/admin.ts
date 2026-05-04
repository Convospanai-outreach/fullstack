import { getServerSession } from "next-auth";
import { getToken } from "next-auth/jwt";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";
import { RequestContext } from "@/lib/requestContext";

export interface AdminUserContext {
    id: string;
    role: string;
    enterpriseRole: UserRole;
}

const ADMIN_LEVEL: Partial<Record<UserRole, number>> = {
    [UserRole.ORG_ADMIN]: 1,
    [UserRole.SYSTEM_ADMIN]: 2,
};

async function getUserFromRequest(): Promise<AdminUserContext | null> {
    const request = RequestContext.get()?.request;
    if (!request) return null;

    const token = await getToken({
        req: request as any,
        secret: process.env["NEXTAUTH_SECRET"],
    });
    const userId = typeof token?.sub === "string" ? token.sub : null;
    if (!userId) return null;

    return prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, enterpriseRole: true },
    });
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
