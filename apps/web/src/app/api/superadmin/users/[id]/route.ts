import { NextRequest, NextResponse } from "next/server";
import { getSuperAdminUserId } from "@/lib/superadmin/session";
import { fetchSuperAdminUserDetail } from "@/lib/superadmin/apiClient";
import { auditSuperAdmin, getSuperAdminActor } from "@/lib/superadmin/actor";

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

const ROLES = ["SUPER_ADMIN", "SYSTEM_ADMIN", "ORG_ADMIN", "CMS_EDITOR", "SALES_MANAGER", "SALES_USER", "CALLER", "VIEWER", "COMPLIANCE_OFFICER"];

// Account controls: { action: "suspend", reason } | { action: "reactivate" } |
// { action: "signOut" } | { action: "setRole", enterpriseRole }.
// Suspending and signing out bump sessionVersion, which ends every existing session
// (apps/web lib/auth.ts jwt callback, apps/api server.ts) within about 30 seconds.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const actor = await getSuperAdminActor();
    if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { id: targetUserId } = await params;
    const input = (await req.json().catch(() => null)) as { action?: unknown; reason?: unknown; enterpriseRole?: unknown } | null;
    const action = typeof input?.action === "string" ? input.action : "";
    if (!["suspend", "reactivate", "signOut", "setRole"].includes(action)) {
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
    if (targetUserId === actor.id && action !== "signOut") {
        return NextResponse.json({ error: "You can't suspend or change the role of your own account here." }, { status: 400 });
    }

    const { prisma } = await import("@/lib/db");
    const target = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, email: true, enterpriseRole: true, suspendedAt: true },
    });
    if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

    let data: Record<string, unknown>;
    let metadata: Record<string, unknown> = { targetUserId, email: target.email };
    if (action === "suspend") {
        const reason = typeof input?.reason === "string" ? input.reason.trim().slice(0, 500) : "";
        if (!reason) return NextResponse.json({ error: "A reason is required to suspend an account." }, { status: 400 });
        data = { suspendedAt: new Date(), suspendedReason: reason, sessionVersion: { increment: 1 } };
        metadata = { ...metadata, reason };
    } else if (action === "reactivate") {
        data = { suspendedAt: null, suspendedReason: null };
    } else if (action === "signOut") {
        data = { sessionVersion: { increment: 1 } };
    } else {
        const role = typeof input?.enterpriseRole === "string" ? input.enterpriseRole : "";
        if (!ROLES.includes(role)) return NextResponse.json({ error: "Unknown role" }, { status: 400 });
        data = { enterpriseRole: role };
        metadata = { ...metadata, from: target.enterpriseRole, to: role };
    }

    await prisma.user.update({ where: { id: targetUserId }, data });
    const { forgetUserAccess } = await import("@/lib/userAccess");
    forgetUserAccess(targetUserId);
    const auditAction = { suspend: "USER_SUSPEND", reactivate: "USER_REACTIVATE", signOut: "USER_SIGN_OUT", setRole: "USER_ROLE_SET" }[action]!;
    await auditSuperAdmin(actor, auditAction, req, metadata);

    const updated = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { enterpriseRole: true, suspendedAt: true, suspendedReason: true },
    });
    return NextResponse.json(updated);
}
