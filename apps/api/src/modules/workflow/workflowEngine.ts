
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export class WorkflowEngine {
    static async execute(workflowId: string, payload: any) {
        try {
            const res = await fetch(`${API_URL}/workflow/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workflowId, payload })
            });
            return await res.json();
        } catch {
            return { status: "FAILED" };
        }
    }

    static async getWorkflowStatus(executionId: string) {
        try {
            const res = await fetch(`${API_URL}/workflow/status?executionId=${executionId}`);
            return await res.json();
        } catch {
            return { status: "UNKNOWN" };
        }
    }
}
