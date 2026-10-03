import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminUserId } from "@/lib/superadmin/session";
import { superAdminRedis } from "@/lib/superadmin/apiClient";

async function superAdminActor() {
    const { prisma } = await import("@/lib/db");
    const userId = await getSuperAdminUserId();
    if (!userId) return null;
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, enterpriseRole: true, superAdminCredential: { select: { id: true } } },
    });
    // Credential row revoked after the cookie was issued - treat as logged out.
    return user?.superAdminCredential ? user : null;
}

export async function GET() {
    const actor = await superAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    try {
        const { status, body } = await superAdminRedis(actor);
        return NextResponse.json(body, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}

// The session cookie is SameSite=Strict, so a cross-site form can't reach this.
export async function POST(req: NextRequest) {
    const actor = await superAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const input = (await req.json().catch(() => null)) as { enabled?: unknown } | null;
    if (typeof input?.enabled !== "boolean") {
        return NextResponse.json({ error: "enabled must be true or false" }, { status: 400 });
    }
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    try {
        const { status, body } = await superAdminRedis(actor, input.enabled);
        if (status < 300) {
            const { prisma } = await import("@/lib/db");
            await prisma.superAdminAuditLog.create({
                data: { userId: actor.id, action: input.enabled ? "REDIS_ENABLE" : "REDIS_DISABLE", ipAddress, metadata: { result: (body as { state?: string }).state ?? null } },
            });
        }
        return NextResponse.json(body, { status });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Upstream request failed";
        return NextResponse.json({ error: message }, { status: 502 });
    }
}
