import { prisma } from "@/lib/db";

class AnalyticsService {
    async getStats(teamId?: string) {
        // Base where clause for team scoping
        const where = teamId ? { teamId } : {};

        const [
            totalLeads,
            totalCampaigns,
            totalEmails,
            emailsSent,
            emailsOpened,
            emailsClicked,
        ] = await Promise.all([
            prisma.lead.count({ where }),
            prisma.campaign.count({ where }),
            prisma.email.count({ where: { campaign: where } }), // Approx scope
            prisma.email.count({ where: { status: "sent", campaign: where } }),
            prisma.email.count({ where: { status: "opened", campaign: where } }),
            prisma.email.count({ where: { status: "clicked", campaign: where } }),
        ]);

        const campaignPerformance = await prisma.campaign.findMany({
            where,
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
                    openRate: emailsSent > 0 ? (emailsOpened / emailsSent) * 100 : 0,
                    clickRate: emailsSent > 0 ? (emailsClicked / emailsSent) * 100 : 0,
                },
            },
            campaignPerformance,
        };
    }

    async getFunnelStats(teamId?: string) {
        const where = teamId ? { teamId } : {};

        // 1. Funnel Stages
        const [
            allLeads,
            replied,
            meetings,
            closed
        ] = await Promise.all([
            prisma.lead.count({ where }),
            prisma.lead.count({ where: { ...where, status: { in: ["REPLIED", "CONTACTED", "QUALIFIED"] } } }),
            prisma.lead.count({ where: { ...where, status: { in: ["MEETING_BOOKED", "MEETING", "PROPOSAL"] } } }),
            prisma.lead.count({ where: { ...where, status: { in: ["CLOSED_WON", "WON"] } } })
        ]);

        // Calculate Revenue
        const revenueResult = await prisma.lead.aggregate({
            where: { ...where, status: { in: ["CLOSED_WON", "WON"] } },
            _sum: { value: true }
        });
        const totalRevenue = revenueResult._sum.value || 0;

        return {
            outreach: allLeads, // Proxy for now
            replied,
            meetings,
            deals: closed,
            revenue: totalRevenue,
            conversionRates: {
                replyRate: allLeads > 0 ? (replied / allLeads) * 100 : 0,
                meetingRate: replied > 0 ? (meetings / replied) * 100 : 0,
                closeRate: meetings > 0 ? (closed / meetings) * 100 : 0
            }
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

        const timeline = Array.from(timelineMap.entries())
            .map(([date, stats]) => ({ date, ...stats }))
            .sort((a, b) => a.date.localeCompare(b.date));

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
            leadsByStatus,
            metrics: {
                total: totalEmails,
                sent,
                opened,
                clicked,
                openRate: sent > 0 ? (opened / sent) * 100 : 0,
                clickRate: sent > 0 ? (clicked / sent) * 100 : 0,
            },
            usage: {
                credits: sent,
                tokens: totalTokens,
                cost: estimatedCost
            },
            timeline
        };
    }

    async getVariantComparison(campaignId: string) {
        const variants = await prisma.campaignVariant.findMany({
            where: { campaignId },
            orderBy: { createdAt: "desc" }
        });

        return variants.map(v => ({
            id: v.id,
            subject: v.subject,
            sent: v.sentCount,
            opened: v.openCount,
            replied: v.replyCount,
            openRate: v.sentCount > 0 ? (v.openCount / v.sentCount) * 100 : 0,
            replyRate: v.sentCount > 0 ? (v.replyCount / v.sentCount) * 100 : 0,
            efficiency: v.replyCount > 0 ? (v.replyCount / v.openCount) * 100 : 0
        }));
    }

    async getCohortAnalysis(teamId: string) {
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: { createdAt: true, status: true, value: true }
        });

        const cohorts: Record<string, any> = {};

        leads.forEach(lead => {
            const date = new Date(lead.createdAt);
            const week = `${date.getFullYear()}-W${Math.ceil(date.getDate() / 7)}`;

            if (!cohorts[week]) {
                cohorts[week] = { week, total: 0, engaged: 0, converted: 0, value: 0 };
            }

            const c = cohorts[week];
            c.total++;
            if (["REPLIED", "MEETING_BOOKED", "CLOSED_WON", "QUALIFIED", "CONTACTED", "MEETING", "PROPOSAL", "WON"].includes(lead.status)) c.engaged++;
            if (lead.status === "CLOSED_WON" || lead.status === "WON") {
                c.converted++;
                c.value += lead.value || 0;
            }
        });

        return Object.values(cohorts).sort((a, b) => b.week.localeCompare(a.week));
    }

    async getForecastingStats(teamId: string) {
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: { status: true, value: true }
        });

        const probabilities: Record<string, number> = {
            "NEW": 0.1,
            "QUALIFIED": 0.3,
            "CONTACTED": 0.4,
            "MEETING": 0.6,
            "PROPOSAL": 0.8,
            "WON": 1.0,
            "CLOSED_WON": 1.0
        };

        let currentRevenue = 0;
        let weightedPipeline = 0;

        leads.forEach(lead => {
            const value = lead.value || 0;
            const prob = probabilities[lead.status] || 0;

            if (lead.status === "WON" || lead.status === "CLOSED_WON") {
                currentRevenue += value;
            } else {
                weightedPipeline += value * prob;
            }
        });

        return {
            currentRevenue,
            weightedPipeline,
            forecastTotal: currentRevenue + weightedPipeline,
            leadCount: leads.length
        };
    }

    async getGovernanceStats(teamId: string) {
        const [
            totalLogs,
            blockedActions,
            approvals,
            policy
        ] = await Promise.all([
            prisma.auditLog.count({ where: { orgId: teamId } }),
            prisma.auditLog.count({ where: { orgId: teamId, action: { contains: "BLOCK" } } }),
            prisma.approvalRequest.findMany({
                orderBy: { createdAt: "desc" },
                take: 100
            }),
            prisma.organizationPolicy.findUnique({ where: { organizationId: teamId } })
        ]);

        const pendingApprovals = approvals.filter((a: any) => a.status === "PENDING").length;
        const approvalRate = approvals.length > 0 ? (approvals.filter((a: any) => a.status === "APPROVED").length / approvals.length) * 100 : 0;

        const complianceSavings = blockedActions * 50;

        return {
            totalLogs,
            blockedActions,
            pendingApprovals,
            approvalRate,
            complianceSavings,
            policyRiskLevel: policy?.maxDailyActions && policy.maxDailyActions > 500 ? "HIGH" : "LOW"
        };
    }
}

export const analyticsService = new AnalyticsService();
