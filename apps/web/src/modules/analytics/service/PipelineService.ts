import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export const PIPELINE_STAGES = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export class PipelineService {
    static async moveLead(leadId: string, newStage: PipelineStage, dealValue?: number) {
        const res = await fetch(`${API_URL}/pipeline/leads/${leadId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStage, dealValue })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data?.error || "Failed to move lead");
        }
        return data;
    }

    static async getPipelineStats() {
        try {
            const res = await fetch(`${API_URL}/pipeline/stats`);
            return await res.json();
        } catch {
            return { totalValue: 0 };
        }
    }

    static async createTask(data: any) {
        const res = await fetch(`${API_URL}/pipeline/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        return await res.json();
    }

    static async updateTask(taskId: string, data: any) {
        const res = await fetch(`${API_URL}/pipeline/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        return await res.json();
    }

    static async getTasks(leadId?: string) {
        try {
            const res = await fetch(`${API_URL}/pipeline/tasks${leadId ? `?leadId=${leadId}` : ""}`);
            return await res.json();
        } catch {
            return [];
        }
    }
}
