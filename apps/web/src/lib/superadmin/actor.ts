import { getSuperAdminUserId } from "@/lib/superadmin/session";

export type SuperAdminActor = { id: string; email: string; enterpriseRole: string };

/** The signed-in superadmin, or null when the cookie is missing/expired or the credential was revoked. */
export async function getSuperAdminActor(): Promise<SuperAdminActor | null> {
    const { prisma } = await import("@/lib/db");
    const userId = await getSuperAdminUserId();
    if (!userId) return null;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, enterpriseRole: true, superAdminCredential: { select: { id: true } } },
    });
    return user?.superAdminCredential ? { id: user.id, email: user.email, enterpriseRole: user.enterpriseRole } : null;
}

/** Writes a SuperAdminAuditLog row for a change made from the panel. */
export async function auditSuperAdmin(actor: SuperAdminActor, action: string, req: Request, metadata: Record<string, unknown>) {
    const { prisma } = await import("@/lib/db");
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
    await prisma.superAdminAuditLog.create({ data: { userId: actor.id, action, ipAddress, metadata: metadata as object } });
}
