import { prisma } from "@/lib/db";
import { SequenceService } from "@/lib/sequenceService";

export class CampaignService {
    static async createCampaign(data: { name: string; description?: string; targetCount?: number; teamId: string }) {
        return await prisma.campaign.create({
            data: {
                name: data.name,
                description: data.description,
                targetCount: data.targetCount || 0,
                status: "draft",
                teamId: data.teamId
            }
        });
    }

    static async addLeadsToCampaign(campaignId: string, leadIds: string[]) {
        // Update leads to belong to this campaign
        await prisma.lead.updateMany({
            where: { id: { in: leadIds } },
            data: { campaignId }
        });

        // Update target count
        const count = await prisma.lead.count({ where: { campaignId } });
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { targetCount: count }
        });

        // Log Activity
        await prisma.activity.create({
            data: {
                type: "CAMPAIGN_UPDATE",
                message: `Added ${leadIds.length} leads to campaign`,
                campaignId,
                meta: { count: leadIds.length }
            }
        });
    }

    static async startCampaign(campaignId: string) {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: { leadList: true, variants: true }
        });

        if (!campaign) throw new Error("Campaign not found");

        // Update status
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: "active" }
        });

        // Log Activity
        await prisma.activity.create({
            data: {
                type: "CAMPAIGN_STATUS",
                message: "Campaign started",
                campaignId,
                meta: { status: "active" }
            }
        });

        // Trigger sequence for all leads in campaign
        for (const lead of campaign.leadList) {
            if (lead.linkedIn && lead.status === "NEW") {
                // Determine variant
                let selectedVariant = null;
                if (campaign.variants.length > 0) {
                    const totalWeight = campaign.variants.reduce((sum, v) => sum + v.weight, 0);
                    let random = Math.random() * totalWeight;
                    for (const variant of campaign.variants) {
                        random -= variant.weight;
                        if (random <= 0) {
                            selectedVariant = variant;
                            break;
                        }
                    }
                    if (!selectedVariant) selectedVariant = campaign.variants[0];
                }

                // In a real implementation, pass selectedVariant.id to SequenceService
                console.log(`Starting sequence for lead ${lead.id} with variant ${selectedVariant?.id || 'default'}`);
                await SequenceService.startSequence(lead.id, lead.linkedIn);
            }
        }
    }

    static async pauseCampaign(campaignId: string) {
        await prisma.campaign.update({
            where: { id: campaignId },
            data: { status: "paused" }
        });

        // Log Activity
        await prisma.activity.create({
            data: {
                type: "CAMPAIGN_STATUS",
                message: "Campaign paused",
                campaignId,
                meta: { status: "paused" }
            }
        });
        // Note: In a real system, we would also need to cancel pending jobs for this campaign
    }

    static async getCampaignStats(campaignId: string) {
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: { _count: { select: { leadList: true } } }
        });

        if (!campaign) throw new Error("Campaign not found");

        const connectedCount = await prisma.lead.count({
            where: { campaignId, status: "CONNECTED" }
        });

        const repliedCount = await prisma.lead.count({
            where: { campaignId, status: "REPLIED" }
        });

        return {
            total: campaign._count.leadList,
            connected: connectedCount,
            replied: repliedCount,
            status: campaign.status
        };
    }

    static async listCampaigns(teamId: string) {
        return await prisma.campaign.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" },
            include: { _count: { select: { leadList: true } } }
        });
    }
}
