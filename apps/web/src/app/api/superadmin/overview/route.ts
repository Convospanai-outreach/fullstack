import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminUserId } from "@/lib/superadmin/session";
import { fetchSuperAdminOverview } from "@/lib/superadmin/apiClient";

export async function GET(req: NextRequest) {
    const { prisma } = await import("@/lib/db");
    const userId = await getSuperAdminUserId();
    if (!userId) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, enterpriseRole: true, superAdminCredential: { select: { id: true } } },
    });
    if (!user || !user.superAdminCredential) {
        // Credential row was revoked after the cookie was issued - treat as logged out.
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const range = new URL(req.url).searchParams.get("range") || "30d";
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    try {
        const { status, body } = await fetchSuperAdminOverview(
            { id: user.id, email: user.email, enterpriseRole: user.enterpriseRole },
            range
        );
        await prisma.superAdminAuditLog.create({
            data: { userId: user.id, action: "VIEW_OVERVIEW", ipAddress, metadata: { range } },
        });
        return NextResponse.json(body, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
