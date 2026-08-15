import { prisma } from "@/lib/db";

const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

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

    // Self-fetches /monitoring/metrics/queue, which doesn't exist, and has zero callers
    // anywhere in the app - left untouched rather than guessed at, matching how the
    // PipelineService precedent (121721a) left the equally-uncalled updateTask alone.
    async getQueueMetrics() {
        try {
            const res = await fetch(`${API_URL}/monitoring/metrics/queue`);
            return await res.json();
        } catch {
            return null;
        }
    }
}

export const monitoringService = new MonitoringService();
