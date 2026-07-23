
import { logger } from "@/lib/logger";

/**
 * Frontend Proxy for AI Service.
 * 
 * Instead of importing heavy AI SDKs (OpenAI, Anthropic, Gemini) directly,
 * this proxy sends requests to the standalone Fastify backend.
 */
export class AIService {
    private async callBackend(action: string, data: any) {
        let apiUrl = process.env['NEXT_PUBLIC_RUNTIME_API_URL'] || (process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy");
        const isServer = typeof window === "undefined";
        if (isServer && data?.teamId) {
            try {
                const { resolveRuntimeEndpoint } = await import("@/domains/runtime-control/dispatchService");
                const resolved = await resolveRuntimeEndpoint(data.teamId, data.userId);
                if (resolved.endpoint) {
                    apiUrl = resolved.endpoint;
                }
            } catch {
                // Fallback to default apiUrl
            }
        }
        try {
            const response = await fetch(`${apiUrl}/ai/execute`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...data })
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(err || `AI Backend Error: ${response.status}`);
            }

            return await response.json();
        } catch (error: any) {
            logger.error(`AI Proxy failed [${action}]:`, error.message);
            throw error;
        }
    }

    public async askAI(prompt: string, teamId?: string, taskContext?: any) {
        const result = await this.callBackend("askAI", { prompt, teamId, taskContext });
        return result.text;
    }

    async getEmbeddings(text: string, teamId?: string): Promise<number[]> {
        const result = await this.callBackend("getEmbeddings", { text, teamId });
        return result.embeddings;
    }

    async generateEmailDraft(lead: any, icp: any, teamId?: string): Promise<{ subject: string; body: string }> {
        return await this.callBackend("generateEmailDraft", { lead, icp, teamId });
    }

    async analyzeProfile(profileText: string, teamId?: string): Promise<string> {
        const result = await this.callBackend("analyzeProfile", { profileText, teamId });
        return result.text;
    }

    async generateComment(postContent: string, profileContext: string, teamId?: string): Promise<string> {
        const result = await this.callBackend("generateComment", { postContent, profileContext, teamId });
        return result.text;
    }

    async generateConnectionMessage(profileContext: string, teamId?: string): Promise<string> {
        const result = await this.callBackend("generateConnectionMessage", { profileContext, teamId });
        return result.text;
    }

    async improveEmail(text: string, teamId?: string): Promise<string> {
        const result = await this.callBackend("improveEmail", { text, teamId });
        return result.text;
    }

    async generateSmartReply(context: string, tone: string = "professional", memories: string[] = [], teamId?: string): Promise<string[]> {
        return await this.callBackend("generateSmartReply", { context, tone, memories, teamId });
    }

    async researchCompany(companyName: string, teamId?: string) {
        return await this.callBackend("researchCompany", { companyName, teamId });
    }
}

export const aiService = new AIService();
export default aiService;
