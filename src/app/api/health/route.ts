import { NextResponse } from "next/server";
import { MonitoringService } from "@/modules/monitoring/MonitoringService";

/**
 * Health check endpoint for monitoring systems
 * GET /api/health
 */
export async function GET() {
    try {
        const health = await MonitoringService.getHealthStatus();

        // Return appropriate HTTP status
        const statusCode = health.status === "healthy" ? 200
            : health.status === "degraded" ? 200
                : 503;

        return NextResponse.json(health, { status: statusCode });

    } catch (error: any) {
        return NextResponse.json({
            status: "unhealthy",
            timestamp: new Date().toISOString(),
            error: error.message
        }, { status: 503 });
    }
}
