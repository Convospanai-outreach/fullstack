import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { AuditService } from "@/modules/audit/auditService";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(req: NextRequest) {
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(ctx.userId, ctx.teamId, TeamRole.ADMIN);

    const logs = await AuditService.getLogs(ctx.teamId);
    return NextResponse.json(logs);
}
