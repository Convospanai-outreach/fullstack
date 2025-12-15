import { prisma } from "@/lib/db";

class AnalyticsService {
    async getStats() {
        const [
            totalLeads,
            totalCampaigns,
            totalEmails,
            emailsSent,
            emailsOpened,
            emailsClicked,
        ] = await Promise.all([
            prisma.lead.count(),
            prisma.campaign.count(),
            prisma.email.count(),
            prisma.email.count({ where: { status: "sent" } }),
            prisma.email.count({ where: { status: "opened" } }),
            prisma.email.count({ where: { status: "clicked" } }),
        ]);

        const campaignPerformance = await prisma.campaign.findMany({
            take: 5,
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                name: true,
                targetCount: true,
                completedCount: true,
                status: true,
            },
        });

        return {
            overview: {
                totalLeads,
                totalCampaigns,
                emailStats: {
                    total: totalEmails,
                    sent: emailsSent,
                    opened: emailsOpened,
                    clicked: emailsClicked,
                    openRate: totalEmails > 0 ? (emailsOpened / totalEmails) * 100 : 0,
                    clickRate: totalEmails > 0 ? (emailsClicked / totalEmails) * 100 : 0,
                },
            },
            campaignPerformance,
        };
    }

    async getCampaignStats(campaignId: string) {
        // 1. Fetch Campaign & Email Data
        const campaign = await prisma.campaign.findUnique({
            where: { id: campaignId },
            include: {
                emails: {
                    select: {
                        id: true,
                        status: true,
                        subject: true,
                        body: true,
                        openedAt: true,
                        createdAt: true
                    }
                }
            }
        });

        if (!campaign) throw new Error("Campaign not found");

        const totalEmails = campaign.emails.length;
        const sent = campaign.emails.filter((e: any) => e.status !== "failed").length;
        const opened = campaign.emails.filter((e: any) => e.status === "opened" || e.status === "clicked").length;
        const clicked = campaign.emails.filter((e: any) => e.status === "clicked").length;

        // 2. Calculate Costs (Real-time)
        // Gemini Pro Output Pricing: ~$0.0000003 per token (approx $0.30/1M) - simplified
        const GEMINI_COST_PER_TOKEN = 0.0000003;

        let totalChars = 0;
        campaign.emails.forEach((email: any) => {
            totalChars += (email.subject?.length || 0) + (email.body?.length || 0);
        });

        const totalTokens = Math.ceil(totalChars / 4);
        const estimatedCost = totalTokens * GEMINI_COST_PER_TOKEN;

        // 3. Timeline Aggregation
        const timelineMap = new Map<string, { sent: number, opened: number }>();

        campaign.emails.forEach((email: any) => {
            const date = email.createdAt.toISOString().split('T')[0];
            if (!timelineMap.has(date)) timelineMap.set(date, { sent: 0, opened: 0 });

            const stat = timelineMap.get(date)!;
            stat.sent++;

            if (email.openedAt) {
                const openDate = email.openedAt.toISOString().split('T')[0];
                if (!timelineMap.has(openDate)) timelineMap.set(openDate, { sent: 0, opened: 0 });
                timelineMap.get(openDate)!.opened++;
            }
        });

        // Convert map to sorted array
        const timeline = Array.from(timelineMap.entries())
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // 4. Leads by Status
        // @ts-ignore
        const leadStatusCounts = await prisma.lead.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: {
                status: true
            }
        });

        const leadsByStatus = leadStatusCounts.reduce((acc: any, curr: any) => {
            acc[curr.status] = curr._count.status;
            return acc;
        }, {} as Record<string, number>);

        return {
            campaign: { id: campaign.id, name: campaign.name, status: campaign.status, createdAt: campaign.createdAt },
            leadsByStatus, // Added this field
            metrics: {
                total: totalEmails,
                sent,
                opened,
                clicked,
                openRate: sent > 0 ? (opened / sent) * 100 : 0,
                clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
            },
            usage: {
                credits: sent, // 1 Credit per sent email
                tokens: totalTokens,
                cost: estimatedCost
            },
            timeline
        };
    }
}

export const analyticsService = new AnalyticsService();
