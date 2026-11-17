import { NextRequest, NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkTeamPermission, TeamRole } from "@/lib/permissions";
import { internalErrorMessage } from "@/lib/internalError";
import { dispatchAuditWebhook, writeAuditLog } from "@/lib/governance/audit";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await getCurrentContext();
    if (!ctx.userId || !ctx.teamId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!await checkTeamPermission(ctx.userId, ctx.teamId, TeamRole.ADMIN)) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const key = await prisma.apiKey.findFirst({
        where: { id, teamId: ctx.teamId },
        select: { id: true, isActive: true }
    });

    if (!key) {
        return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    if (key.isActive) {
        // The revoke and its audit row commit together: a revoked key with no record of who
        // revoked it must not be possible. A failed audit write fails the request.
        const auditParams = {
            actorId: ctx.userId,
            orgId: ctx.teamId,
            action: "API_KEY_REVOKED",
            entity: "ApiKey",
            entityId: id,
            metadata: {}
        };
        let log;
        try {
            log = await prisma.$transaction(async (tx) => {
                const revoked = await tx.apiKey.updateMany({
                    where: { id, teamId: ctx.teamId, isActive: true },
                    data: { isActive: false }
                });
                if (revoked.count !== 1) return null;
                return writeAuditLog(tx, auditParams);
            });
        } catch (error) {
            return NextResponse.json({ error: internalErrorMessage(error, "Could not revoke the API key") }, { status: 500 });
        }

        if (!log) {
            return NextResponse.json({ error: "API key not found" }, { status: 404 });
        }
        await dispatchAuditWebhook(log, auditParams);
    }

    return NextResponse.json({ success: true });
}
