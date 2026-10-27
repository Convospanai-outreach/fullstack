import { prisma } from "@/lib/db";

export interface AuditParams {
    actorId: string;
    orgId: string;
    action: string;
    entity: string;
    entityId?: string;
    metadata?: any;
}

// The slice of a Prisma client (or interactive-transaction client) that writing a row needs.
type AuditDb = { auditLog: { create: (args: any) => Promise<any> } };

/**
 * Writes the audit row on the given client. Pass a transaction client to make the row commit or
 * roll back together with the change it records.
 */
export async function writeAuditLog(
    db: AuditDb,
    { actorId, orgId, action, entity, entityId, metadata }: AuditParams
) {
    return db.auditLog.create({
        data: {
            actorId,
            orgId,
            action,
            entity,
            entityId: entityId ?? null,
            metadata: metadata ?? null,
        },
    });
}

/**
 * Governance webhook dispatch for a written row. Call it after the transaction commits: it reads
 * and enqueues on the global client, and announcing a change that may still roll back is wrong.
 */
export async function dispatchAuditWebhook(
    log: { id: string; createdAt: Date },
    { actorId, orgId, action, entity, entityId, metadata }: AuditParams
) {
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

export async function audit(params: AuditParams) {
    const log = await writeAuditLog(prisma, params);
    await dispatchAuditWebhook(log, params);
}
