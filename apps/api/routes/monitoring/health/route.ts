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

    return NextResponse.json(health, {
        status: health.status === "healthy" ? 200 : 503
    });
}
