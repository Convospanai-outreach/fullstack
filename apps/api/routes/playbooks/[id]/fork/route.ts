import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const original = await prisma.playbook.findUnique({ where: { id } });
    if (!original) return new NextResponse("Playbook not found", { status: 404 });

    // Create fork
    const fork = await prisma.playbook.create({
        data: {
            name: `Copy of ${original.name}`,
            description: original.description,
            config: original.config as any,
            parameters: original.parameters as any,
            visibility: "INTERNAL",
            teamId,
            isLocked: false
        }
    });

    await audit({
        actorId: userId,
        orgId: teamId,
        action: "PLAYBOOK_FORK",
        entity: "Playbook",
        entityId: fork.id,
        metadata: { parentId: original.id }
    });

    return NextResponse.json(fork);
}
