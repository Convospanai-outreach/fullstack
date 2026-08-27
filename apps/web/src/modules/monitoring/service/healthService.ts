import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

class HealthService {
    async getHealth() {
        try {
            const res = await fetch(`${API_URL}/health`);
            return await res.json();
        } catch {
            return {
                database: { status: "unhealthy", latency: 0 },
                system: { status: "ok", uptime: 0 },
                timestamp: new Date().toISOString()
            };
        }
    }
}

export const healthService = new HealthService();
