import { prisma } from "@/lib/db";
import { PIIScrubber } from "@/lib/governance/PIIScrubber";

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
        ipAddress: string | null = null
    ) {
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
            await prisma.auditLog.create({
                data: {
                    orgId: teamId,
                    actorId: userId || "SYSTEM", // actorId is required in unchecked but mapped to userId which was nullable. Added system fallback.
                    action,
                    entity: resource,
                    entityId: resourceId || null,
                    metadata: safeDetails || null,
                    ipAddress: ipAddress || null
                }
            });
        } catch (error) {
            console.error("[AuditService] Failed to log action:", error);
            // Non-blocking: don't throw, just log error so flow continues
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
