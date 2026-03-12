import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
    const { userId, teamId } = await getCurrentContext();

    if (!userId || !teamId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const [
            newLeadsCount,
            qualifiedCount,
            meetingsCount,
            campaigns,
            activities
        ] = await Promise.all([
            prisma.lead.count({ where: { teamId, status: "NEW" } }),
            prisma.lead.count({ where: { teamId, status: { in: ["QUALIFIED", "INTERESTED"] } } }),
            prisma.meeting.count({ where: { teamId } }),
            prisma.campaign.findMany({
                where: { teamId },
                take: 5,
                orderBy: { createdAt: "desc" },
                include: {
                    _count: {
                        select: { leadList: true }
                    }
                }
            }),
            prisma.auditLog.findMany({
                where: { orgId: teamId },
                take: 10,
                orderBy: { createdAt: "desc" },
                include: { user: { select: { name: true } } }
            })
        ]);

        const stats = [
            { id: "s1", title: "New Leads", value: newLeadsCount.toString(), change: 0, icon: "🔍" },
            { id: "s2", title: "Qualified", value: qualifiedCount.toString(), change: 0, icon: "✅" },
            { id: "s3", title: "Meetings", value: meetingsCount.toString(), change: 0, icon: "📅" },
        ];

        // Mock revenue series
        const revenueSeries = Array.from({ length: 30 }).map((_, i) => ({
            day: `D${i + 1}`,
            value: Math.round(200 + Math.sin(i / 3) * 80 + Math.random() * 50),
        }));

        const mappedCampaigns = campaigns.map((c) => ({
            id: c.id,
            name: c.name,
            audience: "Target Audience",
            leads: c._count.leadList,
            status: c.status,
        }));

        const mappedActivities = activities.map((a) => ({
            agent: a.user?.name || "System",
            action: a.action,
            time: new Date(a.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }));

        return NextResponse.json({
            stats,
            revenueSeries,
            campaigns: mappedCampaigns,
            activities: mappedActivities,
        });

    } catch (error) {
        console.error("Dashboard API Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
