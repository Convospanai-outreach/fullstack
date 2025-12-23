import { generateWithGemini } from "@/ai/gemini";
import { prisma } from "@/lib/db";

export class PipelineAIService {
    /**
     * Analyze recent messages and suggest follow-up tasks
     */
    static async suggestTasks(teamId: string, leadId: string) {
        const messages = await prisma.message.findMany({
            where: { leadId },
            take: 10,
            orderBy: { createdAt: "desc" }
        });

        if (messages.length === 0) return [];

        const conversationText = messages.reverse().map(m => `${m.direction}: ${m.content}`).join("\n");

        const prompt = `
        Conversation History:
        ${conversationText}

        Based on this conversation, suggest 1-2 actionable sales tasks.
        Format: JSON array of objects with { "title": "...", "description": "...", "priority": "LOW/MEDIUM/HIGH", "dueDate": "ISO Date" }
        If no tasks are needed, return [].
        `;

        try {
            const response = await generateWithGemini(prompt);
            // Basic JSON parsing (handling potential markdown blocks)
            const cleaned = response.replace(/```json/g, "").replace(/```/g, "").trim();
            return JSON.parse(cleaned);
        } catch (error) {
            console.error("AI Task Suggestion failed", error);
            return [];
        }
    }

    /**
     * Recommend a pipeline stage transition
     */
    static async recommendStage(leadId: string) {
        const lead = await prisma.lead.findUnique({
            where: { id: leadId },
            include: { messages: { take: 10, orderBy: { createdAt: "desc" } } }
        });

        if (!lead || lead.messages.length === 0) return null;

        const conversationText = lead.messages.reverse().map(m => `${m.direction}: ${m.content}`).join("\n");

        const prompt = `
        Current Lead Status: ${lead.status}
        Conversation History:
        ${conversationText}

        Available Stages: NEW, QUALIFIED, CONTACTED, MEETING, PROPOSAL, WON, LOST

        Analyze the lead's intent. Should they move to a new stage? 
        If yes, return the stage name. If no, return null.
        Response Format: Just the stage name or "null".
        `;

        try {
            const response = await generateWithGemini(prompt);
            const choice = response.trim().toUpperCase();
            return choice === "NULL" ? null : choice;
        } catch (error) {
            return null;
        }
    }

    /**
     * Summarize lead status for Kanban cards
     */
    static async summarizeLead(leadId: string) {
        const messages = await prisma.message.findMany({
            where: { leadId },
            take: 5,
            orderBy: { createdAt: "desc" }
        });

        if (messages.length === 0) return "New lead, no interaction yet.";

        const prompt = `
        Summarize this lead's current status and interest level in under 15 words based on these messages:
        ${messages.map(m => m.content).join("\n")}
        `;

        try {
            return await generateWithGemini(prompt);
        } catch (error) {
            return "Status analysis unavailable.";
        }
    }
}
