import { BaseAgent } from "../BaseAgent";

export interface ThreadContext {
    messages: { role: string; content: string }[];
}

export interface InboxAnalysis {
    sentiment: "positive" | "neutral" | "negative";
    sentimentScore: number;
    summary: string;
    suggestedReplies: string[];
    nextBestAction: string;
}

export class InboxAgent extends BaseAgent {
    async analyzeThread(context: ThreadContext): Promise<InboxAnalysis> {
        const conversationText = context.messages.map(m => `${m.role}: ${m.content}`).join("\n");

        const prompt = `
            Act as a CRM AI Assistant. Analyze the following sales conversation:

            ${conversationText}

            Tasks:
            1. Determine the sentiment of the lead (positive/neutral/negative).
            2. Assign a sentiment score (0-100).
            3. Summarize the deal status in 1 sentence.
            4. Suggest 3 short, context-aware smart replies for the sales rep.
            5. Recommend the Next Best Action (e.g., "Schedule Demo", "Send Pricing").
        `;

        const schema = `
        {
            "sentiment": "positive" | "neutral" | "negative",
            "sentimentScore": number,
            "summary": "string",
            "suggestedReplies": ["string", "string", "string"],
            "nextBestAction": "string"
        }
        `;

        return this.generateJSON<InboxAnalysis>(prompt, schema);
    }
}
