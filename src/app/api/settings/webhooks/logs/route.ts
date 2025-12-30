import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";

export async function GET(
    req: NextRequest,
    { params: _params }: { params: Promise<{ id: string }> }
) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const { searchParams } = new URL(req.url);
    const webhookId = searchParams.get("webhookId");

    if (!webhookId) {
        return NextResponse.json({ error: "webhookId required" }, { status: 400 });
    }

    // Ensure the webhook belongs to the team
    const webhook = await prisma.webhook.findFirst({
        where: { id: webhookId, teamId }
    });

    if (!webhook) {
        return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }

    const logs = await prisma.webhookLog.findMany({
        where: { webhookId },
        orderBy: { createdAt: "desc" },
        take: 50
    });

    return NextResponse.json(logs);
}
