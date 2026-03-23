import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import { webhookService } from "@/modules/webhooks/service/webhookService";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const body = await req.json();
    const { webhookId } = body;

    if (!webhookId) return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });

    const webhook = await prisma.webhook.findUnique({
        where: { id: webhookId, teamId }
    });

    if (!webhook) return NextResponse.json({ error: "Webhook not found" }, { status: 404 });

    try {
        // We bypass the queue for test events to give immediate feedback if possible, 
        // but WebhookService processDelivery uses fetch which is async friendly.
        await webhookService.processDelivery(webhook.id, "webhook.test.ping", {
            message: "This is a test event from ConvoSpan to verify your endpoint synchronization.",
            timestamp: new Date().toISOString()
        });

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
