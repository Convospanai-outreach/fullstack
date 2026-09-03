import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export class UsageService {
    static async recordUsage(teamId: string, type: string, amount: number) {
        try {
            await fetch(`${API_URL}/usage/record`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, type, amount })
            });
        } catch (error) {
            console.error("Usage record proxy failed:", error);
        }
    }

    static async getUsageStats(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/usage/stats?teamId=${teamId}`);
            return await res.json();
        } catch {
            return { total: 0 };
        }
    }
}
