import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/governance/audit";
import { enforcePolicy } from "@/lib/governance/guard";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return new NextResponse("Unauthorized", { status: 401 });

    const playbook = await prisma.playbook.findUnique({ where: { id: id } });
    if (!playbook) return new NextResponse("Playbook not found", { status: 404 });
    if (playbook.teamId !== teamId) return new NextResponse("Forbidden", { status: 403 });

    // 1. Governance check for PUBLIC publish
    try {
        await enforcePolicy({
            orgId: teamId,
            userId,
            action: "PUBLISH_PUBLIC_PLAYBOOK",
            payload: { playbookId: id }
        });
    } catch (error: any) {
        if (error.message === "APPROVAL_REQUIRED") {
            const request = await prisma.approvalRequest.create({
                data: {
                    teamId,
                    actionType: "PLAYBOOK_PUBLISH",
                    entityType: "Playbook",
                    entityId: id,
                    requesterId: userId,
                    payload: { playbookId: id, targetVisibility: "PUBLIC" }
                }
            });
            return NextResponse.json({ status: "PENDING_APPROVAL", requestId: request.id });
        }
        return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // 2. Publish (Make PUBLIC)
    const updated = await prisma.playbook.update({
        where: { id: id },
        data: {
            visibility: "PUBLIC"
        }
    });

    await audit({
        actorId: userId,
        orgId: teamId,
        action: "PLAYBOOK_PUBLISH",
        entity: "Playbook",
        entityId: id,
        metadata: { visibility: "PUBLIC" }
    });

    return NextResponse.json(updated);
}
