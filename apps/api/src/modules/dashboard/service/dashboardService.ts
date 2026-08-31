import { prisma } from "@/lib/db";

type Stats = {
    leadsCount: number;
    campaignsCount: number;
    recentLeads: Array<{ id: string; name?: string; email?: string; createdAt: string }>;
    recentCampaigns: Array<{ id: string; name?: string; status?: string; createdAt: string }>;
    dailyActivity: Array<{ date: string; leads: number; campaigns: number }>;
};

function formatISODate(d: Date) {
    return d.toISOString().slice(0, 10);
}

export async function getDashboardStats(teamId: string): Promise<Stats> {
    // Counts
    const [leadsCount, campaignsCount] = await Promise.all([
        prisma.lead.count({ where: { teamId } }).catch(() => 0),
        prisma.campaign.count({ where: { teamId } }).catch(() => 0),
    ]);

    // Recent items
    const [recentLeads, recentCampaigns] = await Promise.all([
        prisma.lead.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, fullName: true, email: true, createdAt: true },
        }).catch(() => []),
        prisma.campaign.findMany({
            where: { teamId },
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, name: true, status: true, createdAt: true },
        }).catch(() => []),
    ]);

    // Daily activity for last 7 days
    const today = new Date();
    const days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() - (6 - i));
        return formatISODate(d);
    });

    // Count per day using raw queries where models may not exist — fallback handled
    const dailyActivity = await Promise.all(
        days.map(async (isoDate) => {
            const start = new Date(isoDate + "T00:00:00.000Z");
            const end = new Date(isoDate + "T23:59:59.999Z");

            const [leads, campaigns] = await Promise.all([
                prisma.lead.count({
                    where: { teamId, createdAt: { gte: start, lte: end } },
                }).catch(() => 0),
                prisma.campaign.count({
                    where: { teamId, createdAt: { gte: start, lte: end } },
                }).catch(() => 0),
            ]);

            return { date: isoDate, leads, campaigns };
        })
    );

    return {
        leadsCount,
        campaignsCount,
        recentLeads: recentLeads.map((r) => ({
            id: r.id,
            ...(r.fullName ? { name: r.fullName } : {}),
            ...(r.email ? { email: r.email } : {}),
            createdAt: r.createdAt.toISOString()
        })),
        recentCampaigns: recentCampaigns.map((c) => ({
            id: c.id,
            ...(c.name ? { name: c.name } : {}),
            ...(c.status ? { status: c.status } : {}),
            createdAt: c.createdAt.toISOString()
        })),
        dailyActivity,
    };
}
