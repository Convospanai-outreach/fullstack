import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import crypto from "crypto";
import { audit } from "@/lib/governance/audit";

export async function GET(_req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const webhooks = await prisma.webhook.findMany({
        where: { teamId },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(webhooks);
}

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const body = await req.json();
    if (!body.url || !body.events) {
        return NextResponse.json({ error: "URL and events required" }, { status: 400 });
    }

    const webhook = await prisma.webhook.create({
        data: {
            url: body.url,
            events: body.events,
            teamId,
            secret: crypto.randomBytes(32).toString("hex"),
            isActive: true
        }
    });

    await audit({
        actorId: userId,
        orgId: teamId,
        action: "WEBHOOK_CREATED",
        entity: "Webhook",
        entityId: webhook.id,
        metadata: { url: webhook.url, events: webhook.events }
    });

    return NextResponse.json(webhook);
}

export async function DELETE(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.webhook.delete({
        where: { id, teamId }
    });

    await audit({
        actorId: userId,
        orgId: teamId,
        action: "WEBHOOK_DELETED",
        entity: "Webhook",
        entityId: id,
        metadata: {}
    });

    return NextResponse.json({ ok: true });
}
