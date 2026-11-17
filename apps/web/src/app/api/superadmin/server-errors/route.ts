import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminUserId } from "@/lib/superadmin/session";

// The details behind 500 responses that showed the caller only a fixed message
// (internalErrorMessage in apps/api and apps/web).
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

    const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 100, 200);
    const [entries, last24h] = await Promise.all([
        prisma.serverError.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { id: true, source: true, label: true, name: true, message: true, stack: true, createdAt: true },
        }),
        prisma.serverError.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    return NextResponse.json({ entries, last24h });
}
