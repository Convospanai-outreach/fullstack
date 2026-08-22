import { NextRequest, NextResponse } from "next/server";
import { getCurrentContextFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JobQueue } from "@/lib/queue";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContextFromRequest(req);
    if (!userId || !teamId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return new NextResponse("User not found", { status: 404 });

    const { authorizeRole, TeamRole, canExportData } = await import("@/lib/permissions");
    try {
        await authorizeRole(user.id, teamId, TeamRole.MEMBER);
        if (!canExportData(user.enterpriseRole)) {
            return new NextResponse("Forbidden", { status: 403 });
        }
    } catch (e: any) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    const body = await req.json();
    const { entity, filters } = body; // e.g., entity: "campaigns"

    // Enqueue export job
    const job = await JobQueue.enqueue("data_export", {
        entity,
        filters,
        userId: user.id,
        teamId
    });

    return NextResponse.json({ ok: true, jobId: job.id });
}
