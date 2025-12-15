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

export default function DashboardPage() {
    const { data: session } = useSession();

    const { data: campaigns } = useCampaigns();
    const { data: activities } = useActivities();
    const { data: agents } = useAgents();

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

    // basic stat placeholders
    const stats = [
        { id: "s1", title: "New Leads", value: campaigns ? campaigns.length : "—", change: 12, icon: "🔍" },
        { id: "s2", title: "Recent Activities", value: activities ? activities.length : "—", change: 6, icon: "✅" },
        { id: "s3", title: "Agents", value: agents ? agents.length : "—", change: 0, icon: "🤖" },
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
                        <ChartCard title="Pipeline (sample)" series={[{ day: "D1", value: 100 }]} subtitle="Live" />
                        <div className="glass p-4 rounded-2xl">
                            <h3 className="text-lg font-semibold text-purple-300 mb-4">Campaigns</h3>
                            <CampaignList campaigns={campaigns || []} />
                        </div>
                    </div>

                    <div className="mt-6 glass p-4 rounded-2xl">
                        <h3 className="text-lg font-semibold text-purple-300 mb-4">Agent Activity</h3>
                        <AgentFeed activities={activities || []} />
                    </div>
                </div>

                <aside className="lg:col-span-1 flex flex-col gap-6">
                    <div className="glass p-4 rounded-2xl">
                        <h4 className="mb-3 text-lg font-semibold text-purple-300">Agent Control</h4>
                        <AgentControl agents={agents || []} />
                    </div>
                </aside>
            </div>
        </div>
    );
}
