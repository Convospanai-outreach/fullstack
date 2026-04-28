
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/db";

export interface SearchFilters {
    query?: string;
    tags?: string[];
    status?: string;
    campaignId?: string;
    teamId: string;
}

export class SearchService {
    static async searchLeads(filters: SearchFilters, page = 1, limit = 50) {
        const { query, tags, status, campaignId, teamId } = filters;
        const skip = (page - 1) * limit;

        const where: Prisma.LeadWhereInput = {
            teamId,
            ...(status && { status }),
            ...(campaignId && { campaignId }),
            ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
        };

        if (query) {
            where.OR = [
                { fullName: { contains: query, mode: "insensitive" } },
                { email: { contains: query, mode: "insensitive" } },
                { company: { contains: query, mode: "insensitive" } },
                { jobTitle: { contains: query, mode: "insensitive" } },
            ];
        }

        const [leads, total] = await Promise.all([
            prisma.lead.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: "desc" },
                include: { campaign: { select: { name: true } } }
            }),
            prisma.lead.count({ where })
        ]);

        return { leads, total, totalPages: Math.ceil(total / limit) };
    }

    static async searchCampaigns(teamId: string, query?: string, status?: string) {
        const where: Prisma.CampaignWhereInput = {
            teamId,
            ...(status && { status }),
        };

        if (query) {
            where.OR = [
                { name: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
            ];
        }

        return await prisma.campaign.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { leadList: true } } }
        });
    }

    static async searchWorkflows(teamId: string, query?: string) {
        return await prisma.workflow.findMany({
            where: {
                teamId,
                ...(query && {
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { description: { contains: query, mode: "insensitive" } },
                    ]
                })
            },
            orderBy: { updatedAt: "desc" }
        });
    }

    static async searchKnowledge(teamId: string, query?: string) {
        return await prisma.knowledgeBase.findMany({
            where: {
                teamId,
                ...(query && {
                    OR: [
                        { name: { contains: query, mode: "insensitive" } },
                        { description: { contains: query, mode: "insensitive" } },
                    ]
                })
            },
            include: { _count: { select: { items: true } } },
            orderBy: { updatedAt: "desc" }
        });
    }

    static async globalSearch(teamId: string, query: string) {
        const [leads, campaigns, workflows, knowledge] = await Promise.all([
            this.searchLeads({ teamId, query }, 1, 5),
            this.searchCampaigns(teamId, query),
            this.searchWorkflows(teamId, query),
            this.searchKnowledge(teamId, query)
        ]);

        return {
            leads: leads.leads,
            campaigns,
            workflows,
            knowledge
        };
    }
}
