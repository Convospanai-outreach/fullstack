import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminUserId } from "@/lib/superadmin/session";

export async function GET(req: NextRequest) {
    const { prisma } = await import("@/lib/db");
    const superAdminUserId = await getSuperAdminUserId();
    if (!superAdminUserId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
        where: { id: superAdminUserId },
        select: { superAdminCredential: { select: { id: true } } },
    });
    if (!actor || !actor.superAdminCredential) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 50, 200);
    const entries = await prisma.superAdminAuditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
            id: true,
            action: true,
            metadata: true,
            ipAddress: true,
            createdAt: true,
            user: { select: { email: true } },
        },
    });

    return NextResponse.json({ entries });
}
