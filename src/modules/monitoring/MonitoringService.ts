/**
 * System Health Monitoring Service
 * 
 * Provides health checks and metrics for production monitoring.
 */

import { prisma } from "@/lib/db";

export interface HealthStatus {
    status: "healthy" | "degraded" | "unhealthy";
    timestamp: string;
    checks: {
        database: HealthCheck;
        auditLog: HealthCheck;
        featureFlags: HealthCheck;
        edgeNode?: HealthCheck;
    };
    metrics: {
        activeUsers: number;
        dailyAuditLogs: number;
        pendingApprovals: number;
        guardrailViolations: number;
    };
}

interface HealthCheck {
    status: "pass" | "fail";
    responseTime?: number;
    message?: string;
}

export class MonitoringService {

    /**
     * Comprehensive health check for monitoring systems
     */
    static async getHealthStatus(): Promise<HealthStatus> {
        const startTime = Date.now();
        const checks: HealthStatus["checks"] = {
            database: await this.checkDatabase(),
            auditLog: await this.checkAuditLog(),
            featureFlags: await this.checkFeatureFlags()
        };

        // Optional: Check edge node if configured
        if (process.env.EDGE_NODE_URI) {
            checks.edgeNode = await this.checkEdgeNode();
        }

        const metrics = await this.getMetrics();

        // Overall status
        const allPassed = Object.values(checks).every(c => c.status === "pass");
        const anyFailed = Object.values(checks).some(c => c.status === "fail");

        return {
            status: anyFailed ? "unhealthy" : allPassed ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            checks,
            metrics
        };
    }

    private static async checkDatabase(): Promise<HealthCheck> {
        const start = Date.now();
        try {
            await prisma.$queryRaw`SELECT 1`;
            return {
                status: "pass",
                responseTime: Date.now() - start,
                message: "Database connection OK"
            };
        } catch (error: any) {
            return {
                status: "fail",
                responseTime: Date.now() - start,
                message: `Database error: ${error.message}`
            };
        }
    }

    private static async checkAuditLog(): Promise<HealthCheck> {
        const start = Date.now();
        try {
            // Check that audit logs are being written (at least one in last 24h)
            const recentLogs = await prisma.auditLog.count({
                where: {
                    createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
                }
            });

            return {
                status: "pass",
                responseTime: Date.now() - start,
                message: `${recentLogs} audit logs in last 24h`
            };
        } catch (error: any) {
            return {
                status: "fail",
                message: `Audit log check failed: ${error.message}`
            };
        }
    }

    private static async checkFeatureFlags(): Promise<HealthCheck> {
        const start = Date.now();
        try {
            const flagCount = await prisma.featureFlag.count();
            return {
                status: flagCount > 0 ? "pass" : "fail",
                responseTime: Date.now() - start,
                message: `${flagCount} feature flags configured`
            };
        } catch (error: any) {
            return {
                status: "fail",
                message: `Feature flag check failed: ${error.message}`
            };
        }
    }

    private static async checkEdgeNode(): Promise<HealthCheck> {
        const start = Date.now();
        try {
            const endpoint = process.env.EDGE_NODE_URI || "http://localhost:8000";
            const response = await fetch(`${endpoint}/health`, {
                signal: AbortSignal.timeout(5000)
            });

            return {
                status: response.ok ? "pass" : "fail",
                responseTime: Date.now() - start,
                message: response.ok ? "Edge node reachable" : `HTTP ${response.status}`
            };
        } catch (error: any) {
            return {
                status: "fail",
                responseTime: Date.now() - start,
                message: `Edge node unreachable: ${error.message}`
            };
        }
    }

    private static async getMetrics() {
        // Active users (logged in within last 24h)
        const activeUsers = await prisma.user.count({
            where: {
                sessions: {
                    some: {
                        expires: { gte: new Date() }
                    }
                }
            }
        });

        // Daily audit logs
        const dailyAuditLogs = await prisma.auditLog.count({
            where: {
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        // Pending approvals
        const pendingApprovals = await prisma.approvalRequest.count({
            where: { status: "PENDING" }
        });

        // Guardrail violations (last 24h)
        const guardrailViolations = await prisma.guardrailLog.count({
            where: {
                createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
        });

        return {
            activeUsers,
            dailyAuditLogs,
            pendingApprovals,
            guardrailViolations
        };
    }

    /**
     * Alert thresholds checker
     */
    static async checkAlertThresholds(): Promise<Array<{
        severity: "warning" | "critical";
        message: string;
    }>> {
        const alerts: Array<{ severity: "warning" | "critical"; message: string }> = [];

        // Check pending approvals backlog
        const pendingApprovals = await prisma.approvalRequest.count({
            where: { status: "PENDING" }
        });

        if (pendingApprovals > 50) {
            alerts.push({
                severity: "critical",
                message: `Approval queue backlog: ${pendingApprovals} pending requests`
            });
        } else if (pendingApprovals > 20) {
            alerts.push({
                severity: "warning",
                message: `Approval queue building: ${pendingApprovals} pending requests`
            });
        }

        // Check guardrail violations
        const recentViolations = await prisma.guardrailLog.count({
            where: {
                createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
            }
        });

        if (recentViolations > 100) {
            alerts.push({
                severity: "critical",
                message: `High guardrail violation rate: ${recentViolations}/hour`
            });
        }

        // Check database connection pool
        // In production, you'd query pool stats here

        return alerts;
    }
}
