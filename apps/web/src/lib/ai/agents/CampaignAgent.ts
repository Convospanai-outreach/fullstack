import { BaseAgent } from "../BaseAgent";

export interface CampaignInput {
    goal: string;
    audience: string;
    tone: string;
}

export interface EmailStep {
    subject: string;
    body: string;
    delayDays: number;
}

export class CampaignAgent extends BaseAgent {
    async generateSequence(input: CampaignInput): Promise<EmailStep[]> {
        const prompt = `
            Act as a world-class Copywriter.
            Write a 3-step cold outreach email sequence.
            
            Context:
            - Goal: ${input.goal}
            - Target Audience: ${input.audience}
            - Tone: ${input.tone} (Professional but conversational)

            Rules:
            - Use {{firstName}} and {{companyName}} variables.
            - Keep subjects short (under 5 words).
            - Step 1: Value proposition.
            - Step 2: Gentle follow-up (2 days later).
            - Step 3: Break-up / Last resource (5 days later).
        `;

        const schema = `
        [
            {
                "subject": "string",
                "body": "string",
                "delayDays": number
            }
        ]
        `;

        return this.generateJSON<EmailStep[]>(prompt, schema);
    }
}
