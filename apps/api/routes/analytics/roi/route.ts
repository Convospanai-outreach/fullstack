import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const requestedMonths = Number(searchParams.get("months"));
    const monthsBack = Number.isFinite(requestedMonths)
        ? Math.min(Math.max(Math.trunc(requestedMonths), 1), 24)
        : 6;

    try {
        // Fetch all campaigns for the team
        const campaigns = await prisma.campaign.findMany({
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
        });

        // Fetch overall lead stats
        const leads = await prisma.lead.findMany({
            where: { teamId },
            select: { status: true, value: true, wonAt: true, updatedAt: true }
        });

        // 1. Calculate Funnel Metrics
        const totalLeads = leads.length;
        const totalSent = campaigns.reduce((acc, c) => acc + c._count.emails, 0); // Assuming 1 email per lead per campaign roughly
        const opportunities = leads.filter(l => ['INTERESTED', 'MEETING_BOOKED', 'NEGOTIATION'].includes(l.status)).length;
        const wins = leads.filter(l => l.status === 'CLOSED_WON').length;

        // Marketing Spend based on recorded LLM usage costs
        const usageLogs = await prisma.lLMUsageLog.findMany({
            where: { teamId }
        });
        const marketingSpend = usageLogs.reduce((acc, u) => acc + (u.cost || 0), 0);

        // Revenue Calculation (Closed Won)
        const revenue = leads.reduce((acc, l) => acc + (l.status === 'CLOSED_WON' ? (l.value || 0) : 0), 0);

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

        // 3. Pipeline History (last N months, default 6)
        const now = new Date();
        const months: { key: string; start: Date; end: Date }[] = [];
        for (let i = monthsBack - 1; i >= 0; i -= 1) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
            const key = start.toISOString().slice(0, 7);
            months.push({ key, start, end });
        }

        const pipelineHistory = months.map((m) => {
            const revenueForMonth = leads.reduce((acc, l) => {
                const wonAt = l.wonAt || l.updatedAt;
                if (l.status === "CLOSED_WON" && wonAt && wonAt >= m.start && wonAt <= m.end) {
                    return acc + (l.value || 0);
                }
                return acc;
            }, 0);

            const spendForMonth = usageLogs.reduce((acc, u) => {
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
