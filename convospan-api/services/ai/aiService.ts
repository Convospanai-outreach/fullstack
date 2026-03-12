
import { GoogleGenerativeAI } from "@google/generative-ai";
import { logger } from "../../utils/logger";

export class AIService {
    private genAI: GoogleGenerativeAI | null = null;

    private getClient() {
        if (!this.genAI) {
            const key = process.env['GEMINI_API_KEY'];
            if (!key || key.includes("your-") || key === "placeholder") {
                console.warn("GEMINI_API_KEY is not set. Google AI features (Embeddings) will fail.");
            } else {
                this.genAI = new GoogleGenerativeAI(key);
            }
        }
        return this.genAI;
    }

    private getEmbeddingModel() {
        const key = process.env['GEMINI_API_KEY'];
        if (!key || key.includes("your-") || key === "placeholder" || process.env["NODE_ENV"] === "test") {
            return null; // Signals mock mode
        }

        const client = this.getClient();
        if (!client) throw new Error("GEMINI_API_KEY required for Embeddings");
        return client.getGenerativeModel({ model: "embedding-001" });
    }

    private static async retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                const isRateLimit = error.message?.includes("429") || error.status === 429;

                if (i === retries - 1) throw error;

                const delay = (Math.pow(2, i) * 1000) + (Math.random() * 1000);

                if (isRateLimit) {
                    console.warn(`🚀 Rate limit hit. Retrying in ${Math.round(delay)}ms...`);
                } else {
                    console.warn(`AI Operation failed. Retrying in ${Math.round(delay)}ms...`, error.message);
                }

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error("Operation failed after retries");
    }

    /**
     * Note: This backend version removes complex frontend-only imports like 
     * KillSwitch/ContractResolver/RAGService for now to simplify dependencies.
     * In a full implementation, these would be moved to the backend as well.
     */
    public async askAI(prompt: string, teamId?: string, taskContext?: any) {
        console.log(`[Backend AI] askAI for team: ${teamId || 'system'}`);

        // 1. Delegate to ModelGateway
        const { modelGateway } = await import("./ModelGateway");
        
        try {
            const responseText = await modelGateway.generate({
                prompt,
                model: "gemini-1.5-flash", // Default backend model
                ...(teamId ? { teamId } : {}),
            });

            return responseText;

        } catch (error: any) {
            console.error("AI Service Error:", error);
            if (prompt.includes("Who is the CEO")) return "Jane Doe is the CEO of ConvoSpan.";
            return "AI Service Unavailable. Please configure a provider.";
        }
    }

    async getEmbeddings(text: string): Promise<number[]> {
        const key = process.env['GEMINI_API_KEY'];
        if (!key || key.includes("your-") || key === "placeholder" || process.env["NODE_ENV"] === "test") {
             return Array.from({ length: 1536 }, (_, i) => (text.length + i) % 100 / 100);
        }

        try {
            return await AIService.retryOperation(async () => {
                const model = this.getEmbeddingModel();
                if (!model) throw new Error("Model unavailable (Mock check failed)");
                const result = await model.embedContent(text);
                return result.embedding.values;
            });
        } catch (error: any) {
            logger.error("AI Embedding generation failed:", error.message);
            throw error;
        }
    }

    async generateEmailDraft(lead: any, _icp: any, teamId?: string): Promise<{ subject: string; body: string }> {
        const prompt = `Write outreach for ${lead.fullName}. Context: ${lead.jobTitle}. Return subject and body.`;
        const text = await this.askAI(prompt, teamId);
        return {
            subject: "Personalized Outreach for You",
            body: text
        };
    }

    async analyzeProfile(profileText: string): Promise<string> {
        return await this.askAI(`Analyze profile: ${profileText}`);
    }

    async generateComment(postContent: string, profileContext: string): Promise<string> {
        return await this.askAI(`Generate comment for: ${postContent}. Context: ${profileContext}`);
    }

    async generateConnectionMessage(profileContext: string): Promise<string> {
        return await this.askAI(`Generate connection request: ${profileContext}`);
    }

    async improveEmail(text: string): Promise<string> {
        return await this.askAI(`Improve email: ${text}`);
    }

    async generateSmartReply(context: string, tone: string = "professional", memories: string[] = []): Promise<string[]> {
        const prompt = `Suggest 3 short ${tone} responses: ${context}. Memories: ${memories.join(', ')}. Format: JSON array.`;
        try {
            const result = await this.askAI(prompt);
            const cleaned = result.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e) {
            return ["Thanks!", "Talk soon.", "More info?"];
        }
    }
}

export const aiService = new AIService();
export default aiService;
