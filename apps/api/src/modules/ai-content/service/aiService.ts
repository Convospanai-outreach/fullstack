
import { aiService as runtimeAI } from "@/lib/aiService";

class AIService {
    async getEmbeddings(text: string, teamId?: string) {
        return runtimeAI.getEmbeddings(text, teamId);
    }

    async generateEmailDraft(lead: any, icp: any, teamId?: string) {
        return runtimeAI.generateEmailDraft(lead, icp, teamId);
    }

    async researchCompany(companyName: string, teamId?: string) {
        return runtimeAI.researchCompany(companyName, teamId);
    }
}

export const aiService = new AIService();
