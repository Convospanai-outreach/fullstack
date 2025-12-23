"use client";
import { useSession, signIn } from "next-auth/react";
import { useCampaigns, useActivities, useAgents } from "@/components/dashboard/useDashboard";
import StatsCard from "@/components/dashboard/StatsCard";
import ChartCard from "@/components/dashboard/ChartCard";
import CampaignList from "@/components/dashboard/CampaignList";
import AgentFeed from "@/components/dashboard/AgentFeed";
import AgentControl from "@/components/dashboard/AgentControl";

import GettingStartedWidget from "@/components/dashboard/GettingStartedWidget";
import WelcomeTour from "@/components/onboarding/WelcomeTour";
import { TaskWidget } from "@/components/dashboard/TaskWidget";
import { useAnalytics } from "@/components/dashboard/useDashboard";
import { ForecastingWidget } from "@/components/dashboard/ForecastingWidget";

export default function DashboardPage() {
    const { data: session } = useSession();

    const { data: campaigns } = useCampaigns();
    const { data: activities } = useActivities();
    const { data: agents } = useAgents();
    const { data: analyticsRes } = useAnalytics();

    if (!session) {
        return (
            <div className="section pt-32 text-center">
                <h2 className="text-2xl mb-4">Sign in required</h2>
                <button
                    className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 transition"
                    onClick={() => signIn()}
                >
                    Sign in
                </button>
            </div>
        );
    }

    const analytics = analyticsRes?.data;

    // Real-time stats
    const stats = [
        {
            id: "s1",
            title: "Total Leads",
            value: analytics?.overview?.totalLeads || "—",
            change: 12,
            icon: "🔍"
        },
        {
            id: "s2",
            title: "Email Outreach",
            value: analytics?.overview?.emailStats?.sent || "—",
            change: 6,
            icon: "✉️"
        },
        {
            id: "s3",
            title: "Agreed Meetings",
            value: analytics?.funnel?.meetings || 0,
            change: 2,
            icon: "🤝"
        },
    ];

    return (
        <div className="section pt-28">
            <WelcomeTour />
            <GettingStartedWidget />
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                        {stats.map((s: any) => <StatsCard key={s.id} {...s} />)}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <ForecastingWidget
                            current={analytics?.forecast?.currentRevenue || 0}
                            weighted={analytics?.forecast?.weightedPipeline || 0}
                            total={analytics?.forecast?.forecastTotal || 0}
                        />
                        <div className="glass p-4 rounded-2xl">
                            <h3 className="text-lg font-semibold text-purple-300 mb-4">Active Campaigns</h3>
                            <CampaignList campaigns={campaigns || []} />
                        </div>
                    </div>

                    <div className="mt-6 glass p-4 rounded-2xl">
                        <h3 className="text-lg font-semibold text-purple-300 mb-4">Agent Activity Feed</h3>
                        <AgentFeed activities={activities || []} />
                    </div>
                </div>

                <aside className="lg:col-span-1 flex flex-col gap-6">
                    <div className="glass p-4 rounded-2xl">
                        <h4 className="mb-3 text-lg font-semibold text-purple-300">Agent Command Center</h4>
                        <AgentControl agents={agents || []} />
                    </div>
                    <TaskWidget />
                </aside>
            </div>
        </div>
    );
}
