import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export enum PipelineStage {
    NEW = "NEW",
    QUALIFIED = "QUALIFIED",
    CONTACTED = "CONTACTED",
    MEETING = "MEETING",
    PROPOSAL = "PROPOSAL",
    WON = "WON",
    LOST = "LOST"
}

export class PipelineService {
    static async moveLead(teamId: string, leadId: string, newStage: PipelineStage, dealValue?: number) {
        try {
            const res = await fetch(`${API_URL}/pipeline/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, leadId, newStage, dealValue })
            });
            return await res.json();
        } catch (error) {
            console.error("Pipeline move proxy failed:", error);
            throw error;
        }
    }

    static async getPipelineStats(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/pipeline/stats?teamId=${teamId}`);
            return await res.json();
        } catch {
            return { totalValue: 0 };
        }
    }

    static async createTask(data: any) {
        try {
            const res = await fetch(`${API_URL}/pipeline/task`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (error) {
            console.error("Task creation proxy failed:", error);
            throw error;
        }
    }

    static async updateTask(teamId: string, taskId: string, data: any) {
        try {
            const res = await fetch(`${API_URL}/pipeline/task`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, taskId, data })
            });
            return await res.json();
        } catch (error) {
            console.error("Task update proxy failed:", error);
            throw error;
        }
    }

    static async getTasks(teamId: string, leadId?: string) {
        try {
            const res = await fetch(`${API_URL}/pipeline/tasks?teamId=${teamId}&leadId=${leadId || ''}`);
            return await res.json();
        } catch {
            return [];
        }
    }
}
