
import { JobQueue } from "@/lib/queue";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { audit } from "@/lib/governance/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();

    if (!userId || !teamId) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    await prisma.agent.update({ where: { id }, data: { status: "idle" } });
    await prisma.activity.create({
        data: { type: "agent-stop", message: `Agent ${id} stopped`, agentId: id },
    });

    await JobQueue.enqueue("agent_stop", { agentId: id, userId });

    // MANDATORY AUDIT LOG
    await audit({
        actorId: userId,
        orgId: teamId,
        action: "AGENT_STOP",
        entity: "Agent",
        entityId: id,
    });

    return NextResponse.json({ ok: true });
}
