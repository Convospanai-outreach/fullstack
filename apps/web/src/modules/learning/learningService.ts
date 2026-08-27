import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

export class LearningService {
    static async recordFeedback(
        teamId: string,
        userId: string,
        messageId: string,
        rating: number,
        comment?: string
    ) {
        try {
            const res = await fetch(`${API_URL}/learning/feedback`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId, userId, messageId, rating, comment })
            });
            if (!res.ok) throw new Error("Learning feedback failure");
            return await res.json();
        } catch (e) {
            console.error("Learning feedback proxy failed:", e);
        }
    }

    static async getMemories(teamId: string) {
        try {
            const res = await fetch(`${API_URL}/learning/memories`, {
                method: "POST", // Using POST for teamId security or GET with query
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ teamId })
            });
            if (!res.ok) throw new Error("Learning memories failure");
            const data = await res.json();
            return data.memories || [];
        } catch (e) {
            console.error("Learning memories proxy failed:", e);
            return [];
        }
    }
}
