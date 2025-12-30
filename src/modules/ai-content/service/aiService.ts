import { generateWithGemini, getEmbeddings } from "@/ai/gemini";
import { LearningService } from "../../learning/learningService";
import { RAGService } from "@/lib/ragService";

class AIService {
    async getEmbeddings(text: string) {
        return await getEmbeddings(text);
    }
    async generateEmailDraft(lead: any, icp: any, teamId?: string) {
        // 1. Fetch Memories (User preferences, tone, style)
        let memories: string[] = [];
        let ragContext = "";

        if (teamId) {
            memories = await LearningService.getMemories(teamId);
            // 2. Fetch RAG Context (Industry knowledge, specific product docs)
            const query = `${lead.company} ${lead.jobTitle}`;
            ragContext = await RAGService.retrieveContext(query, teamId);
        }

        // 3. Build Structured Prompt
        const prompt = `
You are a senior sales representative. Your goal is to write a highly personalized and compelling outreach email.

LEAD CONTEXT:
- Name: ${lead.fullName || lead.firstName || "there"}
- Company: ${lead.company || "your company"}
- Job Title: ${lead.jobTitle || "professional"}
- LinkedIn: ${lead.linkedIn || "N/A"}

ICP (Ideal Customer Profile) CONTEXT:
${icp ? JSON.stringify(icp, null, 2) : "Focus on scaling software businesses and high-efficiency outreach."}

KNOWLEDGE BASE & CASE STUDIES:
${ragContext || "N/A - Use general industry best practices."}

TEAM PREFERENCES & MEMORIES:
${memories.length > 0 ? memories.map(m => `- ${m}`).join('\n') : "Tone: Professional yet conversational. Goal: Book a discovery call."}

TASK:
Write an email that feels personal, not automated. 
- Avoid generic "I hope this finds you well".
- Focus on a specific benefit or observation about their role/company.
- Keep it short (under 150 words).

RESPONSE FORMAT:
Subject: [Subject Line]
Body: [Email Body]
`;

        // 3. Call AI
        const rawResponse = await generateWithGemini(prompt);

        // 4. Parse Response
        const subjectMatch = rawResponse.match(/Subject:\s*(.*)/i);
        const bodyMatch = rawResponse.match(/Body:\s*([\s\S]*)/i);

        return {
            subject: subjectMatch && subjectMatch[1] ? subjectMatch[1].trim() : `Re: Opportunity at ${lead.company}`,
            body: bodyMatch && bodyMatch[1] ? bodyMatch[1].trim() : rawResponse,
        };
    }
    async researchCompany(companyName: string) {
        const prompt = `
            Act as a market researcher. Analyze the company "${companyName}".
            Provide:
            1. A 2-sentence summary of what they do.
            2. Estimated typical employee count for this type of company.
            3. Their primary industry.
            
            Return strictly valid JSON in this format:
            {
                "summary": "...",
                "industry": "...",
                "employees": "...",
                "revenue": "..."
            }
        `;

        try {
            const result = await generateWithGemini(prompt);
            // Extract JSON from potential markdown blocks e.g. ```json ... ```
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
            return { summary: result, industry: "Unknown" };
        } catch (e) {
            console.error("AI Research failed", e);
            return { summary: `Could not research ${companyName}`, industry: "Unknown" };
        }
    }
}

export const aiService = new AIService();
