import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();
const isServer = typeof window === "undefined";

export type TrainingRecordData = {
    task_type: string;
    input_text: string;
    brand_rules: Record<string, any>;
    policy_rules: Record<string, any>;
    expected_output: string;
    rejection_conditions: any[];
};

export class DatasetService {
    static async createDataset(teamId: string, name: string) {
        try {
            const res = await fetch(`${API_URL}/training/dataset`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, name })
            });
            return await res.json();
        } catch (error) {
            console.error("Dataset creation proxy failed:", error);
            throw error;
        }
    }

    static async listDatasets(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/training/dataset/list?teamId=${teamId}`);
            return await res.json();
        } catch {
            return [];
        }
    }

    static async addRecord(datasetId: string, record: TrainingRecordData) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            await prisma.trainingRecord.create({
                data: {
                    datasetId,
                    taskType: record.task_type as any,
                    inputText: record.input_text,
                    brandRules: record.brand_rules as any,
                    policyRules: record.policy_rules as any,
                    expectedOutput: record.expected_output,
                    rejectionConditions: record.rejection_conditions as any
                }
            });
            return { success: true };
        }
        const res = await fetch(`${API_URL}/training/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ datasetId, record })
        });
        return await res.json();
    }
}

export const datasetService = DatasetService;
