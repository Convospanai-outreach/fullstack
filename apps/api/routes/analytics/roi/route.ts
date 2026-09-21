import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const rawMonths = searchParams.get("months");
    const requestedMonths = rawMonths ? Number(rawMonths) : NaN;
    const monthsBack = Number.isFinite(requestedMonths)
        ? Math.min(Math.max(Math.trunc(requestedMonths), 1), 24)
        : 6;

    try {
        // 3. Pipeline History window (last N months, default 6). Built first so the
        // history queries below can be bounded to exactly this window instead of
        // loading every lead/usage-log ever (I-04). The reduce compares Date values
        // directly, so months[0].start is an exact lower bound (no padding needed).
        const now = new Date();
        const months: { key: string; start: Date; end: Date }[] = [];
        for (let i = monthsBack - 1; i >= 0; i -= 1) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const key = start.toISOString().slice(0, 7);
            months.push({ key, start, end });
        }
        const historyCutoff = months[0]!.start;

        // All-time funnel/financial figures come from count/aggregate (computed in
        // the DB) instead of loading every row and reducing in memory. The two
        // *_History queries are bounded to the requested window. campaigns.findMany
        // is left unbounded on purpose - per-team campaign counts are small and it's
        // not what I-04 flagged; its per-variant openCount/replyCount sums need the
        // rows anyway.
        const [
            campaigns,
            totalLeads,
            opportunities,
            wins,
            revenueAgg,
            spendAgg,
            historyLeads,
            historyUsage,
        ] = await Promise.all([
            prisma.campaign.findMany({
                where: { teamId },
                include: {
                    variants: true,
                    _count: {
                        select: {
                            leadList: true,
                            emails: true
                        }
                    }
                }
            }),
            prisma.lead.count({ where: { teamId } }),
            prisma.lead.count({ where: { teamId, status: { in: ['INTERESTED', 'MEETING_BOOKED', 'NEGOTIATION'] } } }),
            prisma.lead.count({ where: { teamId, status: 'CLOSED_WON' } }),
            prisma.lead.aggregate({ where: { teamId, status: 'CLOSED_WON' }, _sum: { value: true } }),
            prisma.lLMUsageLog.aggregate({ where: { teamId }, _sum: { cost: true } }),
            prisma.lead.findMany({
                where: {
                    teamId,
                    status: 'CLOSED_WON',
                    OR: [
                        { wonAt: { gte: historyCutoff } },
                        { wonAt: null, updatedAt: { gte: historyCutoff } },
                    ],
                },
                select: { value: true, wonAt: true, updatedAt: true },
            }),
            prisma.lLMUsageLog.findMany({
                where: { teamId, createdAt: { gte: historyCutoff } },
                select: { cost: true, createdAt: true },
            }),
        ]);

        // 1. Calculate Funnel Metrics
        const totalSent = campaigns.reduce((acc, c) => acc + c._count.emails, 0); // Assuming 1 email per lead per campaign roughly

        // Marketing Spend based on recorded LLM usage costs
        const marketingSpend = spendAgg._sum.cost || 0;

        // Revenue Calculation (Closed Won)
        const revenue = revenueAgg._sum.value || 0;

        // ROI
        const profit = revenue - marketingSpend;
        const roi = marketingSpend > 0 ? (profit / marketingSpend) * 100 : 0;

        // 2. Campaign Comparison Data
        const campaignPerformance = campaigns.map(c => {
            const sent = c._count.emails;
            const openRate = c.variants.length > 0 ? (c.variants.reduce((acc, v) => acc + v.openCount, 0) / (sent || 1)) * 100 : 0;
            const replyRate = c.variants.length > 0 ? (c.variants.reduce((acc, v) => acc + v.replyCount, 0) / (sent || 1)) * 100 : 0;

            return {
                id: c.id,
                name: c.name,
                sent,
                openRate,
                replyRate,
                status: c.status
            };
        });

        // 3. Pipeline History (months window built above). historyLeads is already
        // filtered to CLOSED_WON in the window, so the reduce only buckets by date.
        const pipelineHistory = months.map((m) => {
            const revenueForMonth = historyLeads.reduce((acc, l) => {
                const wonAt = l.wonAt || l.updatedAt;
                if (wonAt && wonAt >= m.start && wonAt <= m.end) {
                    return acc + (l.value || 0);
                }
                return acc;
            }, 0);

            const spendForMonth = historyUsage.reduce((acc, u) => {
                if (u.createdAt >= m.start && u.createdAt <= m.end) {
                    return acc + (u.cost || 0);
                }
                return acc;
            }, 0);

            return { date: m.key, revenue: revenueForMonth, spend: spendForMonth };
        });

        return NextResponse.json({
            funnel: {
                totalLeads,
                totalSent,
                opportunities,
                wins,
                conversionRate: totalLeads > 0 ? (wins / totalLeads) * 100 : 0
            },
            financials: {
                spend: marketingSpend,
                revenue,
                roi,
                profit
            },
            campaigns: campaignPerformance,
            history: pipelineHistory
        });

    } catch (error) {
        console.error("[Analytics API] Error:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
