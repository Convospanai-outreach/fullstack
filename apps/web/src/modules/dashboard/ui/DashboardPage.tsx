"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ActivityTimeline } from "@/components/dashboard/ActivityTimeline";
import { LeadTable } from "@/components/dashboard/LeadTable";
import { CreditUsageChart } from "@/components/dashboard/CreditUsageChart";
import { ICPAnalysisUI } from "@/components/dashboard/ICPAnalysisUI";
import { LinkedInRunMonitor } from "@/components/dashboard/LinkedInRunMonitor";
import { QuickStartGuide } from "@/components/dashboard/QuickStartGuide";
import { AnalyticsDashboard } from "@/components/analytics/AnalyticsDashboard";

export default function DashboardPage() {
    const [stats, setStats] = useState<any>(null);
    const [latestJob, setLatestJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "analytics">("overview");

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch stats
                const statsRes = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/dashboard/stats");
                const statsJson = await statsRes.json();
                if (statsJson.ok) {
                    setStats(statsJson.stats);
                }

                // Fetch latest job
                const jobsRes = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/jobs?limit=1");
                const jobsJson = await jobsRes.json();
                if (jobsJson.jobs && jobsJson.jobs.length > 0) {
                    setLatestJob(jobsJson.jobs[0]);
                }
            } catch (error) {
                console.error("Failed to fetch dashboard data", error);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    if (loading) {
        return <div className="p-8 text-white">Loading dashboard...</div>;
    }

    const leads = stats?.recentLeads || [];
    const campaigns = stats?.recentCampaigns || [];
    const activities = campaigns.map((c: any) => ({
        id: c.id,
        title: `Campaign: ${c.name}`,
        time: new Date(c.createdAt).toLocaleDateString(),
        status: c.status || "Unknown"
    }));

    const showQuickStart = !stats?.campaignsCount || stats.campaignsCount === 0;

    return (
        <div className="p-8 min-h-screen relative overflow-hidden">
            <div className="relative z-10">
                <div className="flex justify-between items-center mb-8">
                    <SectionHeader title="Dashboard" subtitle="Overview of your AI Agent Army" />

                    {/* Tab Switcher */}
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setActiveTab("overview")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "overview" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                        >
                            Overview
                        </button>
                        <button
                            onClick={() => setActiveTab("analytics")}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "analytics" ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:text-white"}`}
                        >
                            Analytics
                        </button>
                    </div>
                </div>

                {activeTab === "overview" ? (
                    <>
                        {showQuickStart && <QuickStartGuide />}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <CreditUsageChart />
                            <ICPAnalysisUI leadsCount={stats?.leadsCount} campaignsCount={stats?.campaignsCount} />
                            <LinkedInRunMonitor job={latestJob} />
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2">
                                <LeadTable leads={leads} />
                            </div>
                            <div>
                                <ActivityTimeline activities={activities} />
                            </div>
                        </div>
                    </>
                ) : (
                    <AnalyticsDashboard />
                )}
            </div>
        </div>
    );
}
