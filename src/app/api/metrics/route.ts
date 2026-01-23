import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { MonitoringService } from "@/modules/monitoring/MonitoringService";
import { UserRole } from "@prisma/client";

/**
 * Metrics endpoint for admin/monitoring dashboards
 * GET /api/metrics
 * 
 * Requires SYSTEM_ADMIN or ORG_ADMIN role
 */
export async function GET(req: NextRequest) {
    const token = await getToken({ req });

    // Authentication required
    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Admin-only endpoint
    const role = token.enterpriseRole as string;
    if (role !== UserRole.SYSTEM_ADMIN && role !== UserRole.ORG_ADMIN) {
        return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    try {
        const health = await MonitoringService.getHealthStatus();
        const alerts = await MonitoringService.checkAlertThresholds();

        return NextResponse.json({
            health,
            alerts,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("[Metrics] Error:", error);
        return NextResponse.json(
            { error: "Internal server error", details: error.message },
            { status: 500 }
        );
    }
}
