import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizeRole, TeamRole } from "@/lib/permissions";
import crypto from "crypto";
import { dispatchAuditWebhook, writeAuditLog } from "@/lib/governance/audit";

export async function POST(req: NextRequest) {
    const { userId, teamId } = await getCurrentContext();
    if (!userId || !teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await authorizeRole(userId, teamId, TeamRole.ADMIN);

    const body = await req.json();
    const { webhookId } = body;

    if (!webhookId) return NextResponse.json({ error: "Webhook ID required" }, { status: 400 });

    const newSecret = crypto.randomBytes(32).toString("hex");

    try {
        const auditParams = {
            actorId: userId,
            orgId: teamId,
            action: "WEBHOOK_SECRET_ROTATED",
            entity: "Webhook",
            entityId: webhookId,
            metadata: {}
        };
        // The rotation and its audit row commit together, so a rotation the caller is told failed
        // has not happened, and one that happened is on record.
        const log = await prisma.$transaction(async (tx) => {
            await tx.webhook.update({
                where: { id: webhookId, teamId },
                data: { secret: newSecret }
            });
            return writeAuditLog(tx, auditParams);
        });
        await dispatchAuditWebhook(log, auditParams);

        return NextResponse.json({ success: true, secret: newSecret });
    } catch (e: any) {
        return NextResponse.json({ error: "Failed to rotate secret" }, { status: 500 });
    }
}
