import { prisma } from "@/lib/db";

export class MonitoringService {
    async checkHealth() {
        const startedAt = Date.now();

        try {
            await prisma.$queryRaw`SELECT 1`;
            return {
                status: "healthy",
                checks: {
                    database: { ok: true, latencyMs: Date.now() - startedAt }
                }
            };
        } catch (error) {
            return {
                status: "unhealthy",
                checks: {
                    database: {
                        ok: false,
                        latencyMs: Date.now() - startedAt,
                        error: error instanceof Error ? error.message : String(error)
                    }
                }
            };
        }
    }
}

export const monitoringService = new MonitoringService();
