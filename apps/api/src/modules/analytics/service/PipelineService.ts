import { prisma } from "@/lib/db";
import { PIPELINE_PRIORITY } from "@/lib/crm/leadStageTransitions";

// The real pipeline vocabulary, shared with the Kanban board and the lead-scoring
// auto-advance logic (both live in leadStageTransitions.ts). CLOSED_WON/CLOSED_LOST
// are a separate concept owned by the journey route's win/loss flow, not this
// manual "move stage" action, so they're intentionally excluded here.
export const PIPELINE_STAGES = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export class PipelineService {
    static async moveLead(teamId: string, leadId: string, newStage: PipelineStage, dealValue?: number) {
        if (!PIPELINE_STAGES.includes(newStage)) {
            throw new Error(`Invalid pipeline stage: ${newStage}`);
        }

        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId } });
        if (!lead) {
            throw new Error("Lead not found");
        }

        const currentState = lead.pipelineState || "COLD";
        const currentRank = PIPELINE_PRIORITY[currentState] ?? 0;
        const nextRank = PIPELINE_PRIORITY[newStage] ?? 0;
        if (nextRank <= currentRank) {
            throw new Error(`Cannot move lead from ${currentState} to ${newStage} — pipeline moves are forward-only`);
        }

        return prisma.lead.update({
            where: { id: leadId },
            data: {
                pipelineState: newStage,
                pipelineStateChangedAt: new Date(),
                ...(dealValue !== undefined ? { value: dealValue } : {}),
            },
        });
    }

    static async getPipelineStats(teamId: string) {
        const result = await prisma.lead.aggregate({
            where: { teamId },
            _sum: { value: true },
        });
        return { totalValue: result._sum.value || 0 };
    }

    static async createTask(data: any) {
        const { teamId, userId, leadId, title, description, priority, dueDate } = data;
        if (leadId) {
            const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId }, select: { id: true } });
            if (!lead) {
                throw new Error("Lead not found");
            }
        }
        return prisma.task.create({
            data: {
                teamId,
                userId,
                leadId,
                title,
                description,
                priority,
                dueDate: dueDate ? new Date(dueDate) : undefined,
            },
        });
    }

    static async getTasks(teamId: string, leadId?: string) {
        return prisma.task.findMany({
            where: { teamId, ...(leadId ? { leadId } : {}) },
            orderBy: { createdAt: "desc" },
        });
    }
}
