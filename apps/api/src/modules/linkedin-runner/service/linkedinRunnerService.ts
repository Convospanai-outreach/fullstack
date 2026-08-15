
import { runLinkedInAction } from "@/linkedin/puppeteerRunner";
import { logger } from "@/lib/logger";

class LinkedInRunnerService {
    async runAutomation(input: { profileUrl: string; action: string }) {
        try {
            const result = await runLinkedInAction(input);
            if (!result.ok) {
                throw new Error(result.error || "LinkedIn automation failed");
            }
            return { result };
        } catch (error) {
            logger.error("[LinkedInRunnerService] Automation failed:", error);
            throw error;
        }
    }
}

export const linkedinRunnerService = new LinkedInRunnerService();
