
import { JobQueue } from "@/lib/queue";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: any) {
    const { id } = params;
    await prisma.agent.update({ where: { id }, data: { status: "idle" } });
    await prisma.activity.create({
        data: { type: "agent-stop", message: `Agent ${id} stopped`, agentId: id },
    });
    // Hook: tell orchestrator to stop
    const session = await getServerSession(authOptions);
    const user = session?.user?.email ? await prisma.user.findUnique({ where: { email: session.user.email } }) : null;

    await JobQueue.enqueue("agent_stop", { agentId: id, userId: user?.id });
    return NextResponse.json({ ok: true });
}
