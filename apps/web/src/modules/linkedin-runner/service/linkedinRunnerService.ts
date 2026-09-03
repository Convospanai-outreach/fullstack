import { getBrowserApiBase } from "@/lib/api/browserBase";

const API_URL = getBrowserApiBase();

class LinkedInRunnerService {
    async runAutomation(input: { profileUrl: string; action: string }) {
        try {
            const res = await fetch(`${API_URL}/linkedin/automate`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ input })
            });
            if (!res.ok) throw new Error("LinkedIn automation proxy failure");
            return await res.json();
        } catch (error) {
            console.error("[LinkedInRunnerService] Automation proxy failed:", error);
            throw error;
        }
    }
}

export const linkedinRunnerService = new LinkedInRunnerService();
