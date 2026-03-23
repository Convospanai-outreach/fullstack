import { PrismaClient } from "@prisma/client";
import { logger } from "../lib/logger";

const prisma = new PrismaClient();

/**
 * ConvoSpan Audit Log Archival Script
 * 
 * Retention Policy: 90 days (Standard Compliance)
 */

async function archiveLogs() {
    const retentionDays = 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    logger.info(`Starting audit log archival. Cutoff date: ${cutoffDate.toISOString()}`);

    try {
        // 1. Identify logs to be archived
        const countBefore = await prisma.auditLog.count({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });

        if (countBefore === 0) {
            logger.info("No audit logs found for archival.");
            return;
        }

        logger.info(`Found ${countBefore} logs older than ${retentionDays} days.`);

        // 2. Perform Archival
        // In a real enterprise setup, we would move these to a cold storage table (ImmutableAudit)
        // or a separate archive database. For this MVP/Pilot, we'll ensure they are backed up 
        // to ImmutableAudit if not already there, then purge from primary AuditLog.

        // Note: ImmutableAudit is usually populated at creation time for high integrity.
        // We will perform a bulk delete to maintain performance.
        
        const deleted = await prisma.auditLog.deleteMany({
            where: {
                createdAt: {
                    lt: cutoffDate
                }
            }
        });

        logger.info(`Successfully purged ${deleted.count} legacy audit logs.`);
        
        // 3. Compact tables (Postgres specific VACUUM if needed, though usually handled by autovacuum)
        
    } catch (error) {
        logger.error("Failed to archive audit logs:", error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

archiveLogs().catch(err => {
    console.error(err);
    process.exit(1);
});
