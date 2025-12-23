import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import { TokenManager } from "./tokenManager";


export class AIService {
    private static genAI: GoogleGenerativeAI | null = null;

    private static getClient() {
        if (!this.genAI) {
            if (!process.env.GEMINI_API_KEY) {
                console.warn("GEMINI_API_KEY is not set. AI features will fail or return mock data.");
                throw new Error("GEMINI_API_KEY is required for AI features.");
            }
            this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        }
        return this.genAI;
    }

    private static getModel() {
        return this.getClient().getGenerativeModel({
            model: "gemini-2.0-flash",
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });
    }

    private static getEmbeddingModel() {
        return this.getClient().getGenerativeModel({ model: "embedding-001" });
    }

    private static async retryOperation<T>(operation: () => Promise<T>, retries = 3): Promise<T> {
        for (let i = 0; i < retries; i++) {
            try {
                return await operation();
            } catch (error: any) {
                if (i === retries - 1) throw error;
                // Exponential backoff: 1s, 2s, 4s
                const delay = Math.pow(2, i) * 1000;
                console.warn(`AI Operation failed. Retrying in ${delay}ms...`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error("Operation failed after retries");
    }

    static async askAI(prompt: string, teamId?: string): Promise<string> {
        // 1. Truncate Input (Safety & Cost)
        const safePrompt = TokenManager.truncate(prompt, 2000); // Limit to ~2k tokens

        // 2. Rate Limit (Global or per-team if we had context)
        if (!TokenManager.checkRateLimit("global_ai", 60, 60)) { // 60 req/min
            console.warn("Rate limit exceeded for AI");
            return "Rate limit exceeded. Please try again later.";
        }

        // 3. Credit Check (Gating)
        if (teamId) {
            const { checkCredits, deductCredits } = await import("./credits");
            const hasCredits = await checkCredits(teamId, 1);
            if (!hasCredits) {
                throw new Error("Insufficient AI Credits. Please upgrade your plan.");
            }
            await deductCredits(teamId, 1, "AI Generation", { prompt: safePrompt.substring(0, 100) });
        }

        return this.retryOperation(async () => {
            const model = this.getModel();
            const result = await model.generateContent(safePrompt);
            const response = await result.response;
            return response.text();
        });
    }

    static async getEmbeddings(text: string): Promise<number[]> {
        const safeText = TokenManager.truncate(text, 1000);
        return this.retryOperation(async () => {
            const model = this.getEmbeddingModel();
            const result = await model.embedContent(safeText);
            return result.embedding.values;
        });
    }

    static async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
        // Optimization: Run in parallel
        const promises = texts.map(text => this.getEmbeddings(text));
        return Promise.all(promises);
    }

    static async analyzeProfile(profileText: string): Promise<string> {
        const prompt = `Analyze the following LinkedIn profile text and provide a brief summary of their professional background, key skills, and potential conversation starters. Keep it under 100 words.\n\nProfile: ${profileText}`;
        return await this.askAI(prompt);
    }

    static async generateComment(postContent: string, profileContext: string): Promise<string> {
        const prompt = `You are a professional networking assistant. Generate a thoughtful, engaging, and professional LinkedIn comment for the following post. The comment should be relevant to the post content and reflect a professional tone. Keep it under 50 words. Do not use hashtags.\n\nPost Content: ${postContent}\n\nMy Context (optional): ${profileContext}`;
        return await this.askAI(prompt);
    }

    static async generateConnectionMessage(profileContext: string): Promise<string> {
        const prompt = `Generate a personalized LinkedIn connection request message (max 300 characters) based on the following profile summary. The message should be polite, professional, and mention a specific detail from their profile to show genuine interest.\n\nProfile Summary: ${profileContext}`;
        return await this.askAI(prompt);
    }

    static async improveEmail(text: string): Promise<string> {
        const prompt = `Rewrite the following email to be more professional, concise, and persuasive for a B2B audience. Keep the same core message.\n\nOriginal: ${text}`;
        return await this.askAI(prompt);
    }

    static async generateSmartReply(context: string, tone: string = "professional", memories: string[] = []): Promise<string[]> {
        let memoryContext = "";
        if (memories.length > 0) {
            memoryContext = `\nUser Preferences (Follow these strictly):\n${memories.map(m => `- ${m}`).join("\n")}\n`;
        }

        const prompt = `Based on the following conversation history, suggest 3 short, ${tone} responses.${memoryContext}\n\nContext: ${context}\n\nFormat: JSON array of strings.`;
        try {
            const result = await this.askAI(prompt);
            // Attempt to parse JSON
            const cleaned = result.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (e) {
            return ["Thanks for the update.", "Let's schedule a call.", "Can you send more info?"];
        }
    }
}
