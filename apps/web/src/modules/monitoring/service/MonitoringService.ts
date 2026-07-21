
const API_URL = (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");

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
