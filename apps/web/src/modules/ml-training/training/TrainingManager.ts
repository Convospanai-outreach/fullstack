/**
 * Training Manager Service
 * Delegates training pipeline start to the API service.
 */

const API_URL = (process.env["NEXT_PUBLIC_API_URL"] || "/api/proxy");

export class TrainingManager {
    async startTraining(datasetId: string, baseModel: string = "gemini-1.5-flash"): Promise<string> {
        if (!datasetId) {
            throw new Error("datasetId is required");
        }

        const response = await fetch(`${API_URL}/training/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ datasetId, baseModel })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data?.error || `Training start failed (${response.status})`);
        }

        if (!data?.pipelineId) {
            throw new Error("Training start did not return pipelineId");
        }

        return data.pipelineId as string;
    }
}

export const trainingManager = new TrainingManager();
