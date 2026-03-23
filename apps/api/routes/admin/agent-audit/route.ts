import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function GET(req: NextRequest) {
    // Verify admin access
    const session = await getServerSession(authOptions);
    const role = session?.user?.enterpriseRole as UserRole | undefined;
    const allowedRoles: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.ORG_ADMIN, UserRole.COMPLIANCE_OFFICER];
    if (!session || !role || !allowedRoles.includes(role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const teamId = params.get("teamId");
    const taskId = params.get("taskId");
    const eventType = params.get("eventType");
    const fromDate = params.get("fromDate");
    const toDate = params.get("toDate");
    const limit = parseInt(params.get("limit") || "100");

    try {
        // Build filter
        const where: any = {
            type: "AGENT" // Only agent events
        };

        if (teamId) where.teamId = teamId;
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
    const session = await getServerSession(authOptions);
    const role = session?.user?.enterpriseRole as UserRole | undefined;
    const allowedRoles: UserRole[] = [UserRole.SYSTEM_ADMIN, UserRole.ORG_ADMIN, UserRole.COMPLIANCE_OFFICER];
    if (!session || !role || !allowedRoles.includes(role)) {
        return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 });
    }

    const body = await req.json();
    const { teamId, fromDate, toDate, format = "json" } = body;

    try {
        const where: any = {
            type: "AGENT"
        };

        if (teamId) where.teamId = teamId;
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
