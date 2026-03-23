import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";

export async function GET(_req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { Permission, authorizePermission } = await import("@/lib/permissions");
    await authorizePermission(ctx.userId, ctx.teamId, Permission.VIEW_AUDIT);

    const logs = await AuditService.getLogs(ctx.teamId);
    return NextResponse.json(logs);
}
