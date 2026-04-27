import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";


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

    const legacyAdmin = user.role === "admin" || user.role === "superadmin";
    const enterpriseAdmin =
        user.enterpriseRole === "SYSTEM_ADMIN" ||
        user.enterpriseRole === "ORG_ADMIN";

    return legacyAdmin || enterpriseAdmin;
}
