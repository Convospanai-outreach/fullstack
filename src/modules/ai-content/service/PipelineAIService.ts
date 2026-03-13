
const API_URL = process.env['NEXT_PUBLIC_API_URL'] || '';

export class PipelineAIService {
    static async suggestTasks(teamId: string, leadId: string) {
        try {
            const res = await fetch(`${API_URL}/ai/pipeline/suggest-tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, leadId })
            });
            if (!res.ok) throw new Error("Pipeline proxy failure");
            return await res.json();
        } catch (error) {
            console.error("AI Task Suggestion proxy failed:", error);
            return [];
        }
    }

    static async recommendStage(leadId: string) {
        try {
            const res = await fetch(`${API_URL}/ai/pipeline/recommend-stage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId })
            });
            if (!res.ok) throw new Error("Pipeline proxy failure");
            const data = await res.json();
            return data.stage || null;
        } catch (error) {
            console.error("AI Stage Recommendation proxy failed:", error);
            return null;
        }
    }

    static async summarizeLead(leadId: string) {
        try {
            const res = await fetch(`${API_URL}/ai/pipeline/summarize-lead`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId })
            });
            if (!res.ok) throw new Error("Pipeline proxy failure");
            const data = await res.json();
            return data.summary || "Summary unavailable.";
        } catch (error) {
            console.error("AI Lead Summary proxy failed:", error);
            return "Status analysis unavailable.";
        }
    }
}
