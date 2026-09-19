import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { monitoringService } from "@/modules/monitoring/service/MonitoringService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    const { userId } = await getCurrentContextFromRequest(req);
    if (!userId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Admin check (using previous logic convention)
    const membership = await prisma.teamMember.findFirst({
        where: { userId },
        include: { team: true }
    });

    if (membership?.role !== "admin" && membership?.role !== "owner") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const health = await monitoringService.checkHealth();

    // apps/web's HealthPage.tsx (modules/monitoring/ui/HealthPage.tsx) expects
    // { ok, health: { database: {status, latency}, system: {status, uptime}, timestamp } } -
    // checkHealth()'s own { status, checks } shape never matched that, so the page always
    // read json.ok as undefined and showed "System status unavailable".
    return NextResponse.json({
        ok: true,
        health: {
            database: {
                status: health.checks.database.ok ? "ok" : "down",
                latency: health.checks.database.latencyMs,
            },
            system: {
                status: health.status === "healthy" ? "ok" : "down",
                uptime: process.uptime(),
            },
            timestamp: new Date().toISOString(),
        },
    }, {
        status: health.status === "healthy" ? 200 : 503
    });
}
