import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth"; // Assuming this helper exists
import { schedulerService } from "@/modules/scheduler/schedulerService";
import { prisma } from "@/lib/db";

export async function GET(_req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const schedules = await prisma.schedule.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(schedules);
}

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    try {
        const body = await req.json();
        // Validation could be added here (e.g., using Zod)

        const schedule = await schedulerService.createSchedule({
            ...body,
            teamId, // Enforce teamId from context
        });

        return NextResponse.json(schedule);
    } catch (error: unknown) {
        return new NextResponse((error as Error).message || "Internal Server Error", { status: 500 });
    }
}
