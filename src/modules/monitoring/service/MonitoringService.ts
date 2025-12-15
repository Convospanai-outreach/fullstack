import { prisma } from "@/lib/db";

export class MonitoringService {
    async checkHealth() {
        const checks = {
            database: await this.checkDatabase(),
            uptime: process.uptime(),
            timestamp: Date.now()
        };

        const isHealthy = checks.database === "connected";
        return {
            status: isHealthy ? "healthy" : "degraded",
            checks
        };
    }

    private async checkDatabase(): Promise<string> {
        try {
            await prisma.$queryRaw`SELECT 1`;
            return "connected";
        } catch (error) {
            console.error("Health check failed (DB):", error);
            return "disconnected";
        }
    }

    // Placeholder for more advanced checks (Queue, Redis, etc.)
    async getQueueMetrics() {
        // In MVP w/o Redis queue inspection, maybe check pending jobs in DB?
        // return { pending: 0, active: 0, failed: 0 };
        return null;
    }
}

export const monitoringService = new MonitoringService();
