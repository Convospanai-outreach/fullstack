import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@/lib/prisma";

export class InboxReplier {
    private genAI: GoogleGenerativeAI | null = null;

    async initialize(userId: string) {
        // 1. Try fetching from User Settings first
        const settings = await prisma.settings.findUnique({
            where: { userId },
            select: { apiKeyGemini: true }
        });

        let apiKey = settings?.apiKeyGemini;

        // 2. Fallback to Env Var
        if (!apiKey) {
            apiKey = process.env.GEMINI_API_KEY;
        }

        if (!apiKey) {
            throw new Error("Gemini API Key not found. Please configure it in Settings.");
        }

        this.genAI = new GoogleGenerativeAI(apiKey);
    }

    async generateDraft(leadId: string, history: any[], userContext: string): Promise<string> {
        if (!this.genAI) throw new Error("InboxReplier not initialized");

        const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

        // Format history for prompt
        const conversationText = history.map(msg =>
            `${msg.direction === 'OUTBOUND' ? 'Me' : 'Lead'}: ${msg.content}`
        ).join("\n");

        const prompt = `
      You are an expert sales assistant. Draft a professional, short, and engaging reply to the following conversation on LinkedIn.
      
      My Context/Goal: ${userContext}

      Conversation History:
      ${conversationText}

      Draft Reply (no quotes, just the text):
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    }
}
