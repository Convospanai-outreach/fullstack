
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export class DataMappingAgent {
    /**
     * Analyze CSV headers and map them to our standard Lead schema.
     * Schema fields: firstName, lastName, email, company, role, linkedin, website, location
     */
    async suggestMapping(headers: string[]): Promise<Record<string, string>> {
        if (!process.env.GEMINI_API_KEY) {
            console.warn("GEMINI_API_KEY is missing, returning empty mapping");
            return {};
        }

        const prompt = `
        You are a Data Import Assistant.
        Match the following CSV Headers to these Database Fields:
        [firstName, lastName, email, company, role, linkedin, website, location]

        CSV Headers: ${JSON.stringify(headers)}

        Rules:
        1. Return JSON ONLY. Format: { "csv_header_name": "db_field_name" }
        2. Only include matches you are confident about.
        3. If "Full Name" is present, map it to "firstName" (we will split it later) or just "firstName".
        4. "Company Name" -> "company", "Job Title" -> "role", "LinkedIn URL" -> "linkedin".
        `;

        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();

            // Clean markdown code blocks if present
            const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();

            return JSON.parse(jsonText);
        } catch (error) {
            console.error("AI Mapping failed:", error);
            return {}; // Fallback to manual
        }
    }
}

export const dataMappingAgent = new DataMappingAgent();
