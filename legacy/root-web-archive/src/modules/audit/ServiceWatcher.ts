
import { prisma } from "@/lib/db";

export type ServiceStatus = "UP" | "DEGRADED" | "DOWN";

export interface ServiceHealth {
    status: ServiceStatus;
    lastPulse: Date | null;
    throughputPerMinute: number;
    errorsLastHour: number;
}

export class ServiceWatcher {
    private static instance: ServiceWatcher;
    private lastPulse: Date | null = null;
    private signalCount: number = 0;
    private startTime: number = Date.now();

    private constructor() { }

    static getInstance(): ServiceWatcher {
        if (!ServiceWatcher.instance) {
            ServiceWatcher.instance = new ServiceWatcher();
        }
        return ServiceWatcher.instance;
    }

    /**
     * Call this whenever a signal is ingested successfully.
     */
    recordPulse() {
        this.lastPulse = new Date();
        this.signalCount++;
    }

    /**
     * Gets the current health of the scraper service.
     */
    async getHealth(): Promise<ServiceHealth> {
        const now = Date.now();
        const minutesElapsed = (now - this.startTime) / 60000;

        // Calculate throughput (capped at last 10 minutes for realism in a real app)
        const throughput = this.signalCount / (minutesElapsed || 1);

        // Determine Status
        let status: ServiceStatus = "UP";

        if (!this.lastPulse || (now - this.lastPulse.getTime() > 1000 * 60 * 15)) {
            status = "DOWN"; // No pulse for 15 minutes
        } else if (throughput < 0.1) {
            status = "DEGRADED"; // Very low throughput
        }

        // Error counting from AuditLog
        const errors = await prisma.auditLog.count({
            where: {
                entity: "Sentinel",
                action: "SENTINEL_BLOCK",
                createdAt: { gte: new Date(now - 1000 * 60 * 60) }
            }
        });

        return {
            status,
            lastPulse: this.lastPulse,
            throughputPerMinute: Math.round(throughput * 100) / 100,
            errorsLastHour: errors
        };
    }
}

export const serviceWatcher = ServiceWatcher.getInstance();
