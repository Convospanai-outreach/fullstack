import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Health check endpoint for container orchestration (K8s, ECS, etc.)
 *
 * GET /api/health              → readiness probe (default in production)
 * GET /api/health?probe=live   → liveness probe (fast, no I/O)
 * GET /api/health?probe=ready  → readiness probe (checks DB connectivity)
 *
 * Returns 200 for healthy, 503 for unhealthy.
 */

type HealthProbeMode = "liveness" | "readiness";

function resolveProbeMode(req: Request): HealthProbeMode {
    const probe = new URL(req.url).searchParams.get("probe")?.toLowerCase();
    if (probe === "live" || probe === "liveness") return "liveness";
    if (probe === "ready" || probe === "readiness") return "readiness";
    // Default: readiness in production, liveness otherwise
    return process.env.NODE_ENV === "production" ? "readiness" : "liveness";
}

export async function GET(req: Request) {
    const startedAt = Date.now();
    const probe = resolveProbeMode(req);

    // Liveness: fast check — proves the process is alive
    if (probe === "liveness") {
        return NextResponse.json({
            status: "alive",
            probe,
            service: "craftmyfunnel-web",
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - startedAt,
        });
    }

    // Readiness: verify downstream dependencies
    let database = "down";

    try {
        // Dynamic import to avoid build-time resolution issues
        const { prisma } = await import("@/lib/db");
        await prisma.$queryRaw`SELECT 1`;
        database = "up";
    } catch {
        database = "down";
    }

    const isHealthy = database === "up";

    return NextResponse.json(
        {
            status: isHealthy ? "healthy" : "unhealthy",
            probe,
            service: "craftmyfunnel-web",
            timestamp: new Date().toISOString(),
            checks: { database },
            durationMs: Date.now() - startedAt,
        },
        { status: isHealthy ? 200 : 503 }
    );
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization, x-correlation-id",
        },
    });
}
