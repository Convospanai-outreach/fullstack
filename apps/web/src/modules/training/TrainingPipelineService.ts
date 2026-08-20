const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export interface TrainingPipelineConfig {
    baseModel?: string;
    epochs?: number;
    learningRate?: number;
    temperature?: number;
    evaluationSplit?: number;
}

export interface TrainingJobState {
    id: string;
    datasetId: string;
    baseModel: string;
    status: "QUEUED" | "VALIDATING_DATASET" | "TRAINING" | "EVALUATING" | "DEPLOYED" | "FAILED";
    configHash: string;
    samplesCount: number;
    refusalAccuracy?: number;
    policyViolationRate?: number;
    driftScore?: number;
    createdAt: string;
    updatedAt: string;
}

export class TrainingPipelineService {
    static async startTraining(datasetId: string, config?: TrainingPipelineConfig) {
        try {
            const res = await fetch(`${API_URL}/training/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ datasetId, config })
            });
            return await res.json();
        } catch (error) {
            console.error("Training start proxy failed:", error);
            throw error;
        }
    }

    static async getPipelineStatus(pipelineId: string) {
        try {
            const res = await fetch(`${API_URL}/training/status?pipelineId=${pipelineId}`);
            return await res.json();
        } catch {
            return { status: "READY" };
        }
    }

    static async getModelStatus(modelId: string) {
        return this.getPipelineStatus(modelId);
    }
}

export const trainingPipeline = TrainingPipelineService;
