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
    /**
     * Move a lead to a new stage and update relevant timestamps
     */
    static async moveLead(teamId: string, leadId: string, newStage: PipelineStage, dealValue?: number) {
        const updateData: any = { status: newStage };

        if (dealValue !== undefined) {
            updateData.value = dealValue;
        }

        if (newStage === PipelineStage.WON) {
            updateData.wonAt = new Date();
        } else if (newStage === PipelineStage.LOST) {
            updateData.lostAt = new Date();
        }

        return await prisma.lead.update({
            where: { id: leadId, teamId },
            data: updateData
        });
    }

    /**
     * Get aggregate stats for the pipeline
     */
    static async getPipelineStats(teamId: string) {
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: { status: true, value: true }
        });

        const stats = leads.reduce((acc: any, lead) => {
            acc[lead.status] = (acc[lead.status] || 0) + 1;
            if (lead.status === PipelineStage.WON) {
                acc.totalValue = (acc.totalValue || 0) + (lead.value || 0);
            }
            return acc;
        }, { totalValue: 0 });

        return stats;
    }

    /**
     * Task Management
     */
    static async createTask(data: {
        teamId: string;
        userId: string;
        leadId?: string;
        title: string;
        description?: string;
        dueDate?: Date;
        priority?: string;
    }) {
        return await prisma.task.create({
            data: {
                ...data,
                status: "TODO"
            }
        });
    }

    static async updateTask(teamId: string, taskId: string, data: any) {
        return await prisma.task.update({
            where: { id: taskId, teamId },
            data
        });
    }

    static async getTasks(teamId: string, leadId?: string) {
        return await prisma.task.findMany({
            where: {
                teamId,
                ...(leadId && { leadId })
            },
            include: { lead: { select: { fullName: true, company: true } } },
            orderBy: { dueDate: "asc" }
        });
    }
}
