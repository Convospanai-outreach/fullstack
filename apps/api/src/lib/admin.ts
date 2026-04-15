import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UserRole } from "@prisma/client";

export async function checkAdmin() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return false;
    }

    const user = await prisma.user.findUnique({
        where: { email: session.user.email },
        select: { role: true, enterpriseRole: true }
    });

    if (!user) return false;

    // Standardize on enterpriseRole for all admin capabilities
    return (
        user.enterpriseRole === UserRole.SYSTEM_ADMIN ||
        user.enterpriseRole === UserRole.ORG_ADMIN
    );
}
