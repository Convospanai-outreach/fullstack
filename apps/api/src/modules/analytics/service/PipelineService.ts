import { prisma } from "@/lib/db";

export enum PipelineStage {
    NEW = "NEW",
    QUALIFIED = "QUALIFIED",
    CONTACTED = "CONTACTED",
    MEETING = "MEETING",
    PROPOSAL = "PROPOSAL",
    WON = "WON",
    LOST = "LOST"
}

export class PipelineService {
    static async moveLead(teamId: string, leadId: string, newStage: PipelineStage, dealValue?: number) {
        const lead = await prisma.lead.findFirst({ where: { id: leadId, teamId } });
        if (!lead) {
            throw new Error("Lead not found");
        }

        return prisma.lead.update({
            where: { id: leadId },
            data: {
                pipelineState: newStage,
                pipelineStateChangedAt: new Date(),
                ...(dealValue !== undefined ? { value: dealValue } : {}),
                ...(newStage === PipelineStage.WON ? { wonAt: new Date() } : {}),
                ...(newStage === PipelineStage.LOST ? { lostAt: new Date() } : {}),
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
