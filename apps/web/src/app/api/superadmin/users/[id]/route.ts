import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminUserId } from "@/lib/superadmin/session";
import { fetchSuperAdminUserDetail } from "@/lib/superadmin/apiClient";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { prisma } = await import("@/lib/db");
    const superAdminUserId = await getSuperAdminUserId();
    if (!superAdminUserId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const actor = await prisma.user.findUnique({
        where: { id: superAdminUserId },
        select: { id: true, email: true, enterpriseRole: true, superAdminCredential: { select: { id: true } } },
    });
    if (!actor || !actor.superAdminCredential) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id: targetUserId } = await params;
    const range = new URL(req.url).searchParams.get("range") || "30d";
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    try {
        const { status, body } = await fetchSuperAdminUserDetail(
            { id: actor.id, email: actor.email, enterpriseRole: actor.enterpriseRole },
            targetUserId,
            range
        );
        await prisma.superAdminAuditLog.create({
            data: { userId: actor.id, action: "VIEW_USER_DETAIL", ipAddress, metadata: { targetUserId, range } },
        });
        return NextResponse.json(body, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
