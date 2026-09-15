
import { JobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { enforcePolicy } from "@/lib/governance/guard";
import { audit } from "@/lib/governance/audit";
import { checkLimits } from "@/lib/governance/limits";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();

    if (!userId || !teamId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // GOVERNANCE CHECKS
    try {
        await checkLimits(teamId, "AGENT_RUN");
        await enforcePolicy({ orgId: teamId, userId, action: "AGENT_RUN" });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Atomic claim: only proceed if this agent belongs to the caller's team and wasn't already
    // running. Without the teamId check, a caller could claim/run another team's agent by
    // guessing its id; without the status check, a double-click or client retry would
    // unconditionally flip status and enqueue a second agent_run job while the first is still
    // in flight.
    const claim = await prisma.agent.updateMany({
        where: { id, teamId, status: { not: "running" } },
        data: { status: "running" },
    });
    if (claim.count === 0) {
        const owned = await prisma.agent.findFirst({ where: { id, teamId }, select: { id: true } });
        if (!owned) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }
        return NextResponse.json({ error: "Agent is already running." }, { status: 409 });
    }
    // add activity
    await prisma.activity.create({
        data: {
            type: "agent-run",
            message: `Agent ${id} started`,
            agentId: id,
        },
    });

    await JobQueue.enqueue(
        "agent_run",
        { agentId: id, userId, teamId },
        { teamId, auditContext: { source: "orchestrator/agents/[id]/run" } }
    );

    // MANDATORY AUDIT LOG
    await audit({
        actorId: userId,
        orgId: teamId,
        action: "AGENT_RUN",
        entity: "Agent",
        entityId: id,
    });

    return NextResponse.json({ ok: true });
}
