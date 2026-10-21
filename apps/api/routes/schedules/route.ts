import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth"; // Assuming this helper exists
import { schedulerService } from "@/modules/scheduler/schedulerService";
import { prisma } from "@/lib/db";
import { forbiddenUnlessRole, TeamRole } from "@/lib/permissions";
import { parseBody } from "@/lib/validation/parseBody";
import { createScheduleSchema } from "@/lib/validation/schemas";

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
    const denied = await forbiddenUnlessRole(userId, teamId, TeamRole.MEMBER);
    if (denied) return denied;

    try {
        const parsed = await parseBody(req, createScheduleSchema);
        if (!parsed.ok) return parsed.response;
        const { campaignId, agentId, ...fields } = parsed.data;

        // A schedule enqueues work and spends credits on behalf of its team, so it may only point at that team's own
        // campaign and agent.
        if (campaignId && !(await prisma.campaign.findFirst({ where: { id: campaignId, teamId }, select: { id: true } }))) {
            return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
        }
        if (agentId && !(await prisma.agent.findFirst({ where: { id: agentId, teamId }, select: { id: true } }))) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        const schedule = await schedulerService.createSchedule({
            ...fields,
            campaignId: campaignId ?? undefined,
            agentId: agentId ?? undefined,
            teamId, // Enforce teamId from context
        });

        return NextResponse.json(schedule);
    } catch (error: unknown) {
        return new NextResponse((error as Error).message || "Internal Server Error", { status: 500 });
    }
}
