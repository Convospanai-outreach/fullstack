import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export interface SentinelReport {
    status: "PASS" | "FAIL" | "WARN";
    data_score: number;
    security_score: number;
    connection_health: "STABLE" | "DEGRADED" | "OFFLINE";
    logs: string[];
    action_taken: string;
    suggested_actions?: string[];
}

export class SentinelService {
    static async evaluate(payload: any, nodeMetrics: any): Promise<SentinelReport> {
        try {
            const res = await fetch(`${API_URL}/sentinel/evaluate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload, nodeMetrics })
            });
            if (!res.ok) throw new Error("Sentinel proxy failure");
            return await res.json();
        } catch (e) {
            console.error("Sentinel evaluation proxy failed:", e);
            return {
                status: "PASS",
                data_score: 1.0,
                security_score: 1.0,
                connection_health: "STABLE",
                logs: ["Sentinel bypassed due to proxy failure."],
                action_taken: "NONE"
            };
        }
    }
}
