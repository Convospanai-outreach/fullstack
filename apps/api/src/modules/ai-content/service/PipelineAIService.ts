import { prisma } from "@/lib/db";
import { aiService } from "@/lib/aiService";

export class PipelineAIService {
    static async suggestTasks(teamId: string, leadId: string) {
        try {
            const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId } });
            if (!lead) return [];
            return await aiService.suggestPipelineTasks(lead, teamId);
        } catch (error) {
            console.error("AI task suggestion failed:", error);
            return [];
        }
    }

    static async recommendStage(leadId: string) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) return null;
            return await aiService.recommendPipelineStage(lead, lead.teamId || undefined);
        } catch (error) {
            console.error("AI stage recommendation failed:", error);
            return null;
        }
    }

    static async summarizeLead(leadId: string) {
        try {
            const lead = await prisma.lead.findUnique({ where: { id: leadId } });
            if (!lead) return "Lead not found.";
            return await aiService.summarizePipelineLead(lead, lead.teamId || undefined);
        } catch (error) {
            console.error("AI lead summary failed:", error);
            return "Status analysis unavailable.";
        }
    }
}
