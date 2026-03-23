
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export class TrainingPipelineService {
    static async startTraining(teamId: string, config: any) {
        try {
            const res = await fetch(`${API_URL}/training/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, config })
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
            return { status: "UNKNOWN" };
        }
    }
}
