import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Client-editable fields only - notably excludes id/teamId (ownership must not
// be reassignable: schedules feed scheduler-driven credit deduction and job
// dispatch keyed on schedule.teamId, so a PATCH that accepted an arbitrary
// teamId would let a team drain another team's credits and inject a job
// tagged with that team's id) and system-managed nextRunAt/lastRunAt.
const SCHEDULE_PATCHABLE_FIELDS = [
    "name",
    "cron",
    "timezone",
    "isActive",
    "batchSize",
    "groundingConfig",
    "campaignId",
    "agentId",
] as const;

function pickPatchableFields(body: Record<string, unknown>) {
    const data: Record<string, unknown> = {};
    for (const key of SCHEDULE_PATCHABLE_FIELDS) {
        if (key in body) data[key] = body[key];
    }
    return data;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const data = pickPatchableFields(body);

    const { count } = await prisma.schedule.updateMany({
        where: { id, teamId },
        data
    });

    if (count === 0) return new NextResponse("Not Found", { status: 404 });

    const updated = await prisma.schedule.findUniqueOrThrow({ where: { id } });

    return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { count } = await prisma.schedule.deleteMany({
        where: { id, teamId }
    });

    if (count === 0) return new NextResponse("Not Found", { status: 404 });

    return new NextResponse("Deleted", { status: 200 });
}
