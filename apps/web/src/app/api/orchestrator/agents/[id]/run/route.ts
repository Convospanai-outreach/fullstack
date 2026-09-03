import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { enforcePolicy } from "@/lib/governance/guard";
import { audit } from "@/lib/governance/audit";
import { checkLimits } from "@/lib/governance/limits";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();

    if (!userId || !teamId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { prisma } = await import("@/lib/db");

    try {
        await checkLimits(teamId, "AGENT_RUN");
        await enforcePolicy({ orgId: teamId, userId, action: "AGENT_RUN" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Atomic claim: only proceed if this agent wasn't already running. Without this guard, a
    // double-click or client retry would unconditionally flip status and enqueue a second
    // agent_run job for the same agent while the first is still in flight.
    const claim = await prisma.agent.updateMany({
        where: { id, status: { not: "running" } },
        data: { status: "running" },
    });
    if (claim.count === 0) {
        return NextResponse.json({ error: "Agent is already running." }, { status: 409 });
    }
    await prisma.activity.create({
        data: {
            type: "agent-run",
            message: `Agent ${id} started`,
            agentId: id,
        },
    });

    try {
        const { JobQueue } = await import("@/lib/queue");
        await JobQueue.enqueue("agent_run", { agentId: id, userId });
    } catch (_e) {
        // Enqueue fallback if queue not provisioned locally
    }

    await audit({
        actorId: userId,
        orgId: teamId,
        action: "AGENT_RUN",
        entity: "Agent",
        entityId: id,
    });

    return NextResponse.json({ ok: true });
}
