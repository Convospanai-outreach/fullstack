import { prisma } from "@/lib/db";
import { PIIScrubber } from "@/lib/governance/PIIScrubber";

// The slice of a Prisma client (or interactive-transaction client) that writing a row needs.
type AuditDb = { auditLog: { create: (args: any) => Promise<unknown> } };

export class AuditService {

    /**
     * Logs an action performed by a user or system in a team workspace.
     */
    static async log(
        teamId: string,
        userId: string | null, // null if system action
        action: string, // e.g. "CAMPAIGN_CREATE", "USER_INVITE"
        resource: string, // e.g. "Campaign", "Team"
        resourceId: string | null,
        details: any = {},
        ipAddress: string | null = null,
        correlationId: string | null = null,
        // Pass strict with a transaction client to make the row commit or roll back together with
        // the change it records; a failed write then propagates instead of being swallowed.
        strict: boolean = false,
        db: AuditDb = prisma
    ) {
        // [Observability] Auto-discover correlation ID if missing
        if (!correlationId) {
            try {
                const { RequestContext } = await import("@/lib/requestContext");
                correlationId = RequestContext.getCorrelationId() || null;

                if (!correlationId) {
                    const { headers } = await import("next/headers");
                    const headerList = await headers();
                    correlationId = headerList.get('x-correlation-id');
                }
            } catch (e) {
                // Ignore: outside of request context
            }
        }
        // Safe metadata handling
        let safeDetails = details;
        try {
            if (details) {
                const asString = JSON.stringify(details);
                if (PIIScrubber.containsPII(asString)) {
                    const scrubbed = PIIScrubber.scrub(asString);
                    safeDetails = JSON.parse(scrubbed);
                }
            }
        } catch (e) {
            // If stringify/parse fails, keep original or fallback
            console.warn("[AuditService] Failed to scrub PII from details", e);
        }

        try {
            await db.auditLog.create({
                data: {
                    orgId: teamId,
                    actorId: userId || "SYSTEM", // actorId is required in unchecked but mapped to userId which was nullable. Added system fallback.
                    action,
                    entity: resource,
                    entityId: resourceId || null,
                    metadata: safeDetails || null,
                    ipAddress: ipAddress || null,
                    correlationId: correlationId || null
                }
            });
        } catch (error) {
            console.error("[AuditService] Failed to log action:", error);
            if (strict) throw error;
            // Non-blocking by default: don't throw, just log error so flow continues
        }
    }

    /**
     * Fetches audit logs for a team with optional filters.
     */
    static async getLogs(teamId: string, limit = 50) {
        return await prisma.auditLog.findMany({
            where: { orgId: teamId },
            include: { user: { select: { name: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Fetches activity for a specific resource (e.g. all logs for a Campaign).
     */
    static async getResourceActivity(resource: string, resourceId: string, limit = 50) {
        return await prisma.auditLog.findMany({
            where: { entity: resource, entityId: resourceId },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * System-wide logs for administrators.
     */
    static async getSystemLogs(limit = 100) {
        return await prisma.auditLog.findMany({
            include: {
                user: { select: { name: true, email: true } },
                team: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }
}
