/**
 * Client Error Alerting Service
 * 
 * Monitors client errors and sends alerts for critical issues
 */

import { prisma } from "@/lib/db";

export interface ErrorAlert {
    severity: "low" | "medium" | "high" | "critical";
    message: string;
    errorCount: number;
    affectedUsers: number;
    url?: string;
    timestamp: Date;
}

export class ClientErrorAlertService {
    private static THRESHOLDS = {
        // Errors per minute before alerting
        errorRate: {
            low: 5,
            medium: 10,
            high: 20,
            critical: 50
        },
        // Unique users affected before alerting
        userImpact: {
            medium: 3,
            high: 10,
            critical: 25
        }
    };

    /**
     * Analyze recent errors and generate alerts
     */
    static async analyzeErrors(timeWindowMinutes: number = 5): Promise<ErrorAlert[]> {
        const since = new Date(Date.now() - timeWindowMinutes * 60 * 1000);

        const recentErrors = await prisma.clientError.findMany({
            where: {
                createdAt: { gte: since }
            },
            select: {
                message: true,
                url: true,
                userId: true,
                ip: true,
                createdAt: true
            }
        });

        const alerts: ErrorAlert[] = [];

        // Check 1: Overall error rate
        const errorRate = recentErrors.length / timeWindowMinutes;
        if (errorRate >= this.THRESHOLDS.errorRate.critical) {
            alerts.push({
                severity: "critical",
                message: `CRITICAL: ${recentErrors.length} errors in ${timeWindowMinutes} minutes (${errorRate.toFixed(1)}/min)`,
                errorCount: recentErrors.length,
                affectedUsers: new Set(recentErrors.map(e => e.userId || e.ip)).size,
                timestamp: new Date()
            });
        } else if (errorRate >= this.THRESHOLDS.errorRate.high) {
            alerts.push({
                severity: "high",
                message: `HIGH: Elevated error rate (${errorRate.toFixed(1)}/min)`,
                errorCount: recentErrors.length,
                affectedUsers: new Set(recentErrors.map(e => e.userId || e.ip)).size,
                timestamp: new Date()
            });
        }

        // Check 2: Errors affecting multiple users
        const affectedUsers = new Set(recentErrors.map(e => e.userId || e.ip)).size;
        if (affectedUsers >= this.THRESHOLDS.userImpact.critical) {
            alerts.push({
                severity: "critical",
                message: `CRITICAL: Errors affecting ${affectedUsers} users`,
                errorCount: recentErrors.length,
                affectedUsers,
                timestamp: new Date()
            });
        } else if (affectedUsers >= this.THRESHOLDS.userImpact.high) {
            alerts.push({
                severity: "high",
                message: `HIGH: Errors affecting ${affectedUsers} users`,
                errorCount: recentErrors.length,
                affectedUsers,
                timestamp: new Date()
            });
        }

        // Check 3: Errors clustered by URL
        const errorsByUrl = new Map<string, typeof recentErrors>();
        for (const error of recentErrors) {
            const url = error.url;
            if (!errorsByUrl.has(url)) {
                errorsByUrl.set(url, []);
            }
            errorsByUrl.get(url)!.push(error);
        }

        for (const [url, errors] of errorsByUrl.entries()) {
            if (errors.length >= 10) {
                const uniqueUsers = new Set(errors.map(e => e.userId || e.ip)).size;
                alerts.push({
                    severity: errors.length >= 20 ? "critical" : "high",
                    message: `${errors.length} errors on ${url} (${uniqueUsers} users affected)`,
                    errorCount: errors.length,
                    affectedUsers: uniqueUsers,
                    url,
                    timestamp: new Date()
                });
            }
        }

        // Check 4: Fatal/Critical errors
        const criticalErrors = recentErrors.filter(e =>
            e.message.toLowerCase().includes("fatal") ||
            e.message.toLowerCase().includes("critical") ||
            e.message.toLowerCase().includes("unhandled")
        );

        if (criticalErrors.length > 0) {
            alerts.push({
                severity: "critical",
                message: `${criticalErrors.length} fatal/critical errors detected`,
                errorCount: criticalErrors.length,
                affectedUsers: new Set(criticalErrors.map(e => e.userId || e.ip)).size,
                timestamp: new Date()
            });
        }

        return alerts;
    }

    /**
     * Send alert via configured channels
     */
    static async sendAlert(alert: ErrorAlert): Promise<void> {
        console.log(`[ErrorAlert:${alert.severity.toUpperCase()}] ${alert.message}`);

        // Create notification in database
        try {
            // Note: Assuming there's a system admin user or we broadcast to all admins
            const admins = await prisma.user.findMany({
                where: {
                    OR: [
                        { role: "ADMIN" },
                        { enterpriseRole: "PLATFORM_ADMIN" }
                    ]
                },
                select: { id: true }
            });

            for (const admin of admins) {
                await prisma.notification.create({
                    data: {
                        userId: admin.id,
                        type: "ERROR_ALERT",
                        message: alert.message,
                        meta: {
                            severity: alert.severity,
                            errorCount: alert.errorCount,
                            affectedUsers: alert.affectedUsers,
                            url: alert.url,
                            timestamp: alert.timestamp.toISOString()
                        }
                    }
                });
            }

            console.log(`[ErrorAlert] Notifications sent to ${admins.length} admins`);
        } catch (error) {
            console.error("[ErrorAlert] Failed to create notifications:", error);
        }

        // TODO: Add additional alert channels:
        // - Email alerts (for critical errors)
        // - Slack webhooks
        // - PagerDuty integration
        // - SMS for critical alerts
    }

    /**
     * Monitor errors and send alerts (run periodically)
     */
    static async monitorAndAlert(timeWindowMinutes: number = 5): Promise<void> {
        try {
            const alerts = await this.analyzeErrors(timeWindowMinutes);

            for (const alert of alerts) {
                await this.sendAlert(alert);
            }

            if (alerts.length > 0) {
                console.log(`[ErrorAlertService] Generated ${alerts.length} alerts`);
            }
        } catch (error) {
            console.error("[ErrorAlertService] Monitoring failed:", error);
        }
    }
}
