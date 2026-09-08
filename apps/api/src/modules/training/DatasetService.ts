
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';
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
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const dataset = await prisma.trainingDataset.create({
                data: {
                    version: name,
                    taskType: "TONE_NORMALIZATION",
                    recordCount: 0,
                    datasetHash: `${name}-${Date.now()}`,
                    configHash: `config-${Date.now()}`,
                    status: "DRAFT"
                }
            });
            return dataset;
        }
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
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const datasets = await prisma.trainingDataset.findMany({
                orderBy: { updatedAt: "desc" }
            });
            return datasets;
        }
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

    static async reviewDataset(datasetId: string, reviewerId: string, sampleSize: number, scores: any) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const avgScore = (scores.policy + scores.tone + scores.clarity + scores.realism) / 4;
            const review = await prisma.datasetReview.create({
                data: {
                    datasetId,
                    reviewerId,
                    sampleSize,
                    avgScore,
                    policyCorrectness: scores.policy,
                    toneQuality: scores.tone,
                    clarity: scores.clarity,
                    realism: scores.realism,
                    approved: true
                }
            });
            return { ...review, approved: true };
        }
        const res = await fetch(`${API_URL}/training/dataset/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ datasetId, reviewerId, sampleSize, scores })
        });
        return await res.json();
    }

    static async approveDataset(datasetId: string) {
        if (isServer) {
            const { prisma } = await import("@/lib/db");
            const dataset = await prisma.trainingDataset.update({
                where: { id: datasetId },
                data: { status: "TRAINING" }
            });
            return dataset;
        }
        const res = await fetch(`${API_URL}/training/dataset/approve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ datasetId })
        });
        return await res.json();
    }
}

export const datasetService = DatasetService;
