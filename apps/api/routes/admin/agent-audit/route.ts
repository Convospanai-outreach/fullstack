import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { UserRole } from "@prisma/client";

// See admin/audit/route.ts - ORG_ADMIN/COMPLIANCE_OFFICER are self-service
// per-workspace roles, not platform-level operators.
const PLATFORM_LEVEL_ROLES: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN];

async function getAgentAuditContext(req: NextRequest): Promise<{ userId: string; role: UserRole } | null> {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { enterpriseRole: true } });
    if (!user) return null;
    return { userId, role: user.enterpriseRole };
}

// Resolves the teamId filter to enforce: platform-level roles may query any team
// (or all teams, if none is specified); a workspace-level ORG_ADMIN/COMPLIANCE_OFFICER
// is restricted to their own team regardless of what teamId they pass.
async function resolveScopedTeamId(userId: string, role: UserRole, requestedTeamId: string | null): Promise<string | null | { forbidden: true }> {
    if (PLATFORM_LEVEL_ROLES.includes(role)) {
        return requestedTeamId;
    }
    const membership = await prisma.teamMember.findFirst({ where: { userId }, select: { teamId: true } });
    if (!membership) return { forbidden: true };
    if (requestedTeamId && requestedTeamId !== membership.teamId) {
        return { forbidden: true };
    }
    return membership.teamId;
}

export async function GET(req: NextRequest) {
    // Verify admin access
    const ctx = await getAgentAuditContext(req);
    const allowedRoles: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.COMPLIANCE_OFFICER];
    if (!ctx || !allowedRoles.includes(ctx.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const requestedTeamId = params.get("teamId");
    const taskId = params.get("taskId");
    const eventType = params.get("eventType");
    const fromDate = params.get("fromDate");
    const toDate = params.get("toDate");
    const limit = parseInt(params.get("limit") || "100");

    const scopedTeamId = await resolveScopedTeamId(ctx.userId, ctx.role, requestedTeamId);
    if (scopedTeamId && typeof scopedTeamId === "object") {
        return NextResponse.json({ error: "Forbidden - not a member of the given team" }, { status: 403 });
    }

    try {
        // Build filter
        const where: any = {
            type: "AGENT" // Only agent events
        };

        if (scopedTeamId) where.teamId = scopedTeamId;
        if (taskId) where.payload = { path: ["taskId"], equals: taskId };
        if (eventType) where.name = eventType;
        if (fromDate) where.timestamp = { ...where.timestamp, gte: new Date(fromDate) };
        if (toDate) where.timestamp = { ...where.timestamp, lte: new Date(toDate) };

        // Query events
        const events = await prisma.systemEvent.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: limit
        });

        // Format response
        const logs = events.map(event => ({
            id: event.id,
            timestamp: event.timestamp,
            eventType: event.name,
            actorId: event.actorId,
            teamId: event.teamId,
            payload: event.payload
        }));

        return NextResponse.json({
            success: true,
            count: logs.length,
            logs
        });

    } catch (error: any) {
        console.error("[AgentAudit] Query failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

// Export audit logs for compliance reporting
export async function POST(req: NextRequest) {
    const ctx = await getAgentAuditContext(req);
    const allowedRoles: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.COMPLIANCE_OFFICER];
    if (!ctx || !allowedRoles.includes(ctx.role)) {
        return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 });
    }

    const body = await req.json();
    const { teamId: requestedTeamId, fromDate, toDate, format = "json" } = body;

    const scopedTeamId = await resolveScopedTeamId(ctx.userId, ctx.role, requestedTeamId ?? null);
    if (scopedTeamId && typeof scopedTeamId === "object") {
        return NextResponse.json({ error: "Forbidden - not a member of the given team" }, { status: 403 });
    }

    try {
        const where: any = {
            type: "AGENT"
        };

        if (scopedTeamId) where.teamId = scopedTeamId;
        if (fromDate) where.timestamp = { ...where.timestamp, gte: new Date(fromDate) };
        if (toDate) where.timestamp = { ...where.timestamp, lte: new Date(toDate) };

        const events = await prisma.systemEvent.findMany({
            where,
            orderBy: { timestamp: 'asc' }
        });

        if (format === "csv") {
            // Generate CSV
            const csv = [
                "Timestamp,Event Type,Actor,Team ID,Task ID",
                ...events.map(e => {
                    const taskId = (e.payload as any).taskId || "N/A";
                    return `${e.timestamp.toISOString()},${e.name},${e.actorId},${e.teamId},${taskId}`;
                })
            ].join("\\n");

            return new NextResponse(csv, {
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": `attachment; filename="agent-audit-${Date.now()}.csv"`
                }
            });
        }

        // Default JSON format
        return NextResponse.json({
            success: true,
            count: events.length,
            exportedAt: new Date().toISOString(),
            events: events.map(e => ({
                timestamp: e.timestamp,
                eventType: e.name,
                actorId: e.actorId,
                teamId: e.teamId,
                payload: e.payload
            }))
        });

    } catch (error: any) {
        console.error("[AgentAudit] Export failed:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
