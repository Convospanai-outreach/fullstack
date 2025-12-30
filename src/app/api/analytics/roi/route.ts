import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const { teamId } = await getCurrentContext();
    if (!teamId) return new NextResponse("Unauthorized", { status: 401 });

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
            select: { status: true, value: true }
        });

        // 1. Calculate Funnel Metrics
        const totalLeads = leads.length;
        const totalSent = campaigns.reduce((acc, c) => acc + c._count.emails, 0); // Assuming 1 email per lead per campaign roughly
        const opportunities = leads.filter(l => ['INTERESTED', 'MEETING_BOOKED', 'NEGOTIATION'].includes(l.status)).length;
        const wins = leads.filter(l => l.status === 'CLOSED_WON').length;

        // Mock Cost Calculation (e.g., $0.05 per email, $100 platform fee)
        const costPerEmail = 0.05;
        const platformFee = 100;
        const marketingSpend = (totalSent * costPerEmail) + platformFee;

        // Revenue Calculation
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

        // 3. Mock Pipeline History (for charts)
        const pipelineHistory = [
            { date: '2025-01', revenue: 12000, spend: 4000 },
            { date: '2025-02', revenue: 18000, spend: 4500 },
            { date: '2025-03', revenue: 15000, spend: 4200 },
            { date: '2025-04', revenue: 24000, spend: 5000 },
            { date: '2025-05', revenue: 32000, spend: 5500 },
            { date: '2025-06', revenue: 45000, spend: 6000 }, // Projected current/future
        ];

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
