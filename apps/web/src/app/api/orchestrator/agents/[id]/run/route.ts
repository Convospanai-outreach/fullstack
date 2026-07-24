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

    await prisma.agent.update({ where: { id }, data: { status: "running" } });
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
