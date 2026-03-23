import { prisma } from "@/lib/prisma";

export const analyticsService = {
    /**
     * Aggregates email stats for a campaign to build the funnel.
     */
    async getCampaignFunnel(campaignId: string) {
        // 1. Get raw counts from Email table
        // 1. Get raw counts from Email table
        // Note: This relies on your Email model having 'status', 'openedAt', etc.
        await prisma.email.groupBy({
            by: ['status'],
            where: { campaignId },
            _count: { id: true },
        });

        const sentCount = await prisma.email.count({
            where: { campaignId, status: { in: ['sent', 'delivered'] } }
        });

        const openedCount = await prisma.email.count({
            where: { campaignId, openedAt: { not: null } }
        });

        // Check if we track replies in Email model (clickedAt is present, replies might be via Message model)
        // For now, let's use clicked as a proxy for engagement deeper than open if replies aren't directly on Email
        const clickedCount = await prisma.email.count({
            where: { campaignId, clickedAt: { not: null } }
        });

        // Also get replies from Message table if linked
        const replyCount = await prisma.message.count({
            where: {
                lead: { campaignId },
                direction: 'INBOUND'
            }
        });

        return {
            sent: sentCount,
            opened: openedCount,
            clicked: clickedCount,
            replied: replyCount
        };
    },

    /**
     * Get daily activity timeline for heatmap/charts
     */
    async getActivityTimeline(campaignId: string, days = 7) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        // Group emails by createdAt date
        const dailyStats = await prisma.email.findMany({
            where: {
                campaignId,
                createdAt: { gte: startDate }
            },
            select: {
                createdAt: true,
                status: true,
                openedAt: true
            }
        });

        // Aggregate in memory (simple for MPV, move to SQL trunc for scale)
        const timeline: Record<string, { sent: number; opened: number }> = {};

        // Init empty days
        for (let i = 0; i <= days; i++) {
            const d = new Date(startDate);
            d.setDate(d.getDate() + i);
            const key = d.toISOString().split('T')[0] || "";
            if (key) timeline[key] = { sent: 0, opened: 0 };
        }

        dailyStats.forEach(email => {
            const dateKey = email.createdAt.toISOString().split('T')[0] || "";
            if (dateKey && timeline[dateKey]) {
                if (['sent', 'delivered'].includes(email.status)) timeline[dateKey].sent++;
                if (email.openedAt) timeline[dateKey].opened++;
            }
        });

        return Object.entries(timeline).map(([date, stats]) => ({
            date,
            ...stats
        })).sort((a, b) => a.date.localeCompare(b.date));
    }
};
