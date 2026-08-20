import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

type ICPInput = {
    name: string;
    description?: string;
    criteria: any;
    status?: string;
};

type ICPFilter = {
    status?: string;
};

class ICPService {
    async create(teamId: string, input: ICPInput) {
        const icp = await prisma.iCP.create({
            data: {
                teamId,
                name: input.name,
                description: input.description ?? null,
                criteria: input.criteria as Prisma.InputJsonValue,
                status: input.status || "active",
            },
        });
        return icp;
    }

    async list(teamId: string, filter: ICPFilter = {}) {
        const where: any = { teamId };
        if (filter.status) {
            where.status = filter.status;
        }

        const icps = await prisma.iCP.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });
        return icps;
    }

    async getById(teamId: string, id: string) {
        const icp = await prisma.iCP.findFirst({
            where: { id, teamId },
        });
        return icp;
    }

    async update(teamId: string, id: string, input: Partial<ICPInput>) {
        const existing = await this.getById(teamId, id);
        if (!existing) return null;
        const icp = await prisma.iCP.update({
            where: { id },
            data: {
                ...(input.name && { name: input.name }),
                ...(input.description !== undefined && { description: input.description }),
                ...(input.criteria && { criteria: input.criteria as Prisma.InputJsonValue }),
                ...(input.status && { status: input.status }),
            },
        });
        return icp;
    }

    async delete(teamId: string, id: string) {
        const existing = await this.getById(teamId, id);
        if (!existing) return false;
        await prisma.iCP.delete({
            where: { id },
        });
        return true;
    }

    // Helper: Match a lead against ICP criteria
    async matchLead(teamId: string, icpId: string, leadData: any): Promise<boolean> {
        const score = await this.scoreLead(teamId, icpId, leadData);
        return score.totalScore >= 50; // Threshold
    }

    // Calculate a fit score (0-100) for a lead against an ICP
    async scoreLead(teamId: string, icpId: string, leadData: any): Promise<{ totalScore: number; details: any }> {
        const icp = await this.getById(teamId, icpId);
        if (!icp) throw new Error("ICP not found");

        const criteria = icp.criteria as any;
        let totalScore = 0;
        const details: any = {};

        // Industry match (30 points)
        if (criteria.industries?.length > 0) {
            if (criteria.industries.includes(leadData.industry)) {
                totalScore += 30;
                details.industry = 30;
            } else {
                details.industry = 0;
            }
        } else {
            // If no industry criteria, give full points (neutral)
            totalScore += 30;
            details.industry = 30;
        }

        // Job title match (40 points)
        if (criteria.jobTitles?.length > 0) {
            const titleMatch = criteria.jobTitles.some((title: string) =>
                leadData.jobTitle?.toLowerCase().includes(title.toLowerCase())
            );
            if (titleMatch) {
                totalScore += 40;
                details.jobTitle = 40;
            } else {
                details.jobTitle = 0;
            }
        } else {
            totalScore += 40;
            details.jobTitle = 40;
        }

        // Company size match (30 points)
        if (criteria.companySize) {
            const size = leadData.companySize;
            if (size >= criteria.companySize.min && size <= criteria.companySize.max) {
                totalScore += 30;
                details.companySize = 30;
            } else {
                details.companySize = 0;
            }
        } else {
            totalScore += 30;
            details.companySize = 30;
        }

        return { totalScore, details };
    }
}

export const icpService = new ICPService();
