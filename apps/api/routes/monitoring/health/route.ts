import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { monitoringService } from "@/modules/monitoring/service/MonitoringService";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request) {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Admin check (using previous logic convention)
    const user = await prisma.user.findUnique({ where: { email: session.user.email } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const membership = await prisma.teamMember.findFirst({
        where: { userId: user.id },
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
