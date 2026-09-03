
import { prisma } from "@/lib/db";

class AnalyticsService {
    async getStats(teamId?: string) {
        if (!teamId) return { overview: {}, campaignPerformance: [] };

        const [totalLeads, totalCampaigns, campaignPerformance, emails] = await Promise.all([
            prisma.lead.count({ where: { teamId } }),
            prisma.campaign.count({ where: { teamId } }),
            prisma.campaign.findMany({
                where: { teamId },
                select: { id: true, name: true, targetCount: true, completedCount: true, status: true }
            }),
            prisma.email.findMany({
                where: { campaign: { teamId } },
                select: { status: true, openedAt: true, clickedAt: true }
            })
        ]);

        const sent = emails.filter((e) => e.status === "sent" || e.status === "delivered").length;
        const opened = emails.filter((e) => e.openedAt).length;
        const clicked = emails.filter((e) => e.clickedAt).length;

        return {
            overview: {
                totalLeads,
                totalCampaigns,
                emailStats: {
                    total: emails.length,
                    sent,
                    opened,
                    clicked,
                    openRate: sent > 0 ? (opened / sent) * 100 : 0,
                    clickRate: sent > 0 ? (clicked / sent) * 100 : 0
                }
            },
            campaignPerformance
        };
    }

    async getFunnelStats(teamId?: string) {
        if (!teamId) return { outreach: 0, replied: 0, meetings: 0, deals: 0, revenue: 0 };

        const [outreach, replied, meetings, wonLeads] = await Promise.all([
            prisma.email.count({ where: { campaign: { teamId } } }),
            prisma.email.count({ where: { campaign: { teamId }, repliedAt: { not: null } } }),
            prisma.meeting.count({ where: { teamId } }),
            prisma.lead.findMany({ where: { teamId, status: "CLOSED_WON" }, select: { value: true } })
        ]);

        return {
            outreach,
            replied,
            meetings,
            deals: wonLeads.length,
            revenue: wonLeads.reduce((acc, l) => acc + (l.value || 0), 0)
        };
    }

    async getCampaignStats(campaignId: string) {
        const [sent, opened, clicked, replied] = await Promise.all([
            prisma.email.count({ where: { campaignId } }),
            prisma.email.count({ where: { campaignId, openedAt: { not: null } } }),
            prisma.email.count({ where: { campaignId, clickedAt: { not: null } } }),
            prisma.email.count({ where: { campaignId, repliedAt: { not: null } } })
        ]);

        const timelineRows = await prisma.email.findMany({
            where: { campaignId },
            select: { createdAt: true, openedAt: true }
        });
        const timelineByDay = new Map<string, { date: string; sent: number; opened: number }>();
        for (const row of timelineRows) {
            const day = row.createdAt.toISOString().slice(0, 10);
            const bucket = timelineByDay.get(day) || { date: day, sent: 0, opened: 0 };
            bucket.sent += 1;
            if (row.openedAt) bucket.opened += 1;
            timelineByDay.set(day, bucket);
        }

        return {
            metrics: { sent, opened, clicked, replied },
            // LLMUsageLog is only scoped by teamId in the current schema, not campaignId,
            // so per-campaign spend genuinely can't be attributed here - left empty rather than guessed.
            usage: {},
            timeline: Array.from(timelineByDay.values()).sort((a, b) => a.date.localeCompare(b.date))
        };
    }

    async getVariantComparison(campaignId: string, teamId: string) {
        // Scoped via the campaign relation - campaignId is caller-supplied and
        // otherwise unverified, so without this a guessed/enumerated id from
        // another team would leak that team's A/B test content and stats.
        const variants = await prisma.campaignVariant.findMany({ where: { campaignId, campaign: { teamId } } });

        return variants.map((v) => ({
            id: v.id,
            subject: v.subject,
            sentCount: v.sentCount,
            openCount: v.openCount,
            replyCount: v.replyCount,
            openRate: v.sentCount > 0 ? (v.openCount / v.sentCount) * 100 : 0,
            replyRate: v.sentCount > 0 ? (v.replyCount / v.sentCount) * 100 : 0
        }));
    }

    async getCohortAnalysis(teamId: string) {
        const now = new Date();
        const months: { key: string; start: Date; end: Date }[] = [];
        for (let i = 5; i >= 0; i -= 1) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            months.push({ key: start.toISOString().slice(0, 7), start, end });
        }

        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: { createdAt: true, status: true }
        });

        return months.map((m) => {
            const cohortLeads = leads.filter((l) => l.createdAt >= m.start && l.createdAt <= m.end);
            return {
                cohort: m.key,
                totalLeads: cohortLeads.length,
                won: cohortLeads.filter((l) => l.status === "CLOSED_WON").length
            };
        });
    }

    async getForecastingStats(teamId: string) {
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: { status: true, value: true, intentScore: true }
        });

        const currentRevenue = leads
            .filter((l) => l.status === "CLOSED_WON")
            .reduce((acc, l) => acc + (l.value || 0), 0);

        // Weighted by Lead.intentScore (0.0-1.0), the only stage-probability signal the schema has.
        const weightedPipeline = leads
            .filter((l) => l.status !== "CLOSED_WON" && l.status !== "CLOSED_LOST")
            .reduce((acc, l) => acc + (l.value || 0) * (l.intentScore || 0), 0);

        return { currentRevenue, weightedPipeline };
    }

    async getGovernanceStats(teamId: string) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [totalLogs, blockedActions, recentLogs] = await Promise.all([
            prisma.guardrailLog.count({ where: { teamId } }),
            prisma.guardrailLog.count({ where: { teamId, action: "blocked" } }),
            prisma.guardrailLog.findMany({
                where: { teamId, createdAt: { gte: since } },
                select: { createdAt: true }
            })
        ]);

        const blockRatio = totalLogs > 0 ? blockedActions / totalLogs : 0;
        const policyRiskLevel = blockRatio > 0.15 ? "HIGH" : blockRatio > 0.05 ? "MEDIUM" : "LOW";

        // 24 real hourly buckets (oldest to newest) of guardrail activity in the last 24h
        const hourlyActivity = new Array(24).fill(0);
        for (const log of recentLogs) {
            const hoursAgo = Math.floor((Date.now() - log.createdAt.getTime()) / (60 * 60 * 1000));
            const bucket = 23 - Math.min(hoursAgo, 23);
            hourlyActivity[bucket]++;
        }

        return { totalLogs, blockedActions, policyRiskLevel, hourlyActivity };
    }
}

export const analyticsService = new AnalyticsService();
