import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export class MonitoringService {
    async checkHealth() {
        try {
            const res = await fetch(`${API_URL}/monitoring/health`);
            return await res.json();
        } catch {
            return { status: "degraded" };
        }
    }

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
