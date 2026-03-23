import { prisma } from "@/lib/db";

export interface AuditParams {
    actorId: string;
    orgId: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: any;
}

export async function audit({
    actorId,
    orgId,
    action,
    entity,
    entityId,
    metadata,
}: AuditParams) {
    const log = await prisma.auditLog.create({
        data: {
            actorId,
            orgId,
            action,
            entity,
            entityId: entityId ?? null,
            metadata: metadata ?? null,
        },
    });

    // Governance Webhook Dispatch
    try {
        const { webhookService } = await import("@/modules/webhooks/service/webhookService");
        await webhookService.dispatch(orgId, "governance.audit", {
            id: log.id,
            actorId,
            action,
            entity,
            entityId,
            metadata,
            timestamp: log.createdAt
        });
    } catch (e) {
        console.warn("[Audit Webhook] Failed to dispatch:", e);
    }
}
