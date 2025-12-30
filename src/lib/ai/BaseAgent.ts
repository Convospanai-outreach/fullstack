import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

export abstract class BaseAgent {
    protected model: GenerativeModel;
    protected apiKey: string;

    constructor() {
        this.apiKey = process.env['GEMINI_API_KEY'] || "";
        if (!this.apiKey) {
            console.warn("GEMINI_API_KEY is missing. AI Agents will return mock data or fail.");
        }
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-pro" });
    }

    /**
     * Generates a structured JSON response from the LLM.
     * @param prompt The prompt to send to the AI.
     * @param schemaDescription A description of the expected JSON schema to guide the AI.
     * @param retries Number of times to retry on failure.
     */
    protected async generateJSON<T>(prompt: string, schemaDescription: string, retries = 2): Promise<T> {
        if (!this.apiKey) {
            throw new Error("Missing API Key");
        }

        const fullPrompt = `
${prompt}

IMPORTANT: You must output ONLY valid JSON.
Response Format:
${schemaDescription}

Do not include markdown formatting like \`\`\`json. Just the raw JSON string.
`;

        let lastError;
        for (let i = 0; i <= retries; i++) {
            try {
                const result = await this.model.generateContent(fullPrompt);
                const response = result.response;
                const text = response.text();

                // fast clean
                const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

                return JSON.parse(cleaned) as T;
            } catch (error) {
                console.warn(`Attempt ${i + 1} failed:`, error);
                lastError = error;
                // Wait briefly before retrying
                if (i < retries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            }
        }

        console.error("AI Generation Error after retries:", lastError);
        throw new Error("Failed to generate valid JSON response from AI after multiple attempts.");
    }
}
