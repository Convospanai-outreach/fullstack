"use client";

import { useEffect, useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from "recharts";

interface AnalyticsStats {
    overview?: {
        totalLeads?: number;
        totalCampaigns?: number;
        emailStats?: {
            total?: number;
            sent?: number;
            opened?: number;
            clicked?: number;
            openRate?: number;
            clickRate?: number;
            replyRate?: number;
        };
    };
    campaignPerformance?: Array<{
        id: string;
        name: string;
        targetCount: number;
        completedCount: number;
        status: string;
    }>;
}

export function AnalyticsDashboard() {
    const [data, setData] = useState<AnalyticsStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        fetch(process.env['NEXT_PUBLIC_API_URL'] + "/analytics/stats")
            .then((res) => res.json())
            .then((result) => {
                setData(result);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading || !mounted) return <div className="p-8 text-center text-gray-400">Loading analytics...</div>;

    // Safely extract values from the actual API shape
    const overview = data?.overview;
    const emailStats = overview?.emailStats;

    const totalLeads = overview?.totalLeads ?? 0;
    const totalCampaigns = overview?.totalCampaigns ?? 0;
    const replyRate = emailStats?.replyRate ?? 0;
    const emailsSent = emailStats?.sent ?? 0;

    // Build funnelData from emailStats
    const funnelData = [
        { name: "Sent", value: emailStats?.sent ?? 0 },
        { name: "Opened (noisy)", value: emailStats?.opened ?? 0 },
        { name: "Clicked", value: emailStats?.clicked ?? 0 },
    ];

    // Build trends from campaignPerformance (target vs completed)
    const trends = (data?.campaignPerformance ?? []).map((cp) => ({
        date: cp.name?.substring(0, 12) || "—",
        sent: cp.targetCount ?? 0,
        replies: cp.completedCount ?? 0,
    }));

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <KPICard title="Total Leads" value={totalLeads} icon="👥" />
                <KPICard title="Active Campaigns" value={totalCampaigns} icon="🚀" />
                <KPICard title="Reply Rate" value={`${replyRate.toFixed(1)}%`} icon="💬" />
                <KPICard title="Emails Sent" value={emailsSent} icon="📧" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Trend Chart */}
                <div className="glass p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold mb-6 gradient-text">Campaign Activity</h3>
                    <div className="h-[300px] w-full">
                        {trends.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                                <LineChart data={trends}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                                    <XAxis dataKey="date" stroke="#94a3b8" />
                                    <YAxis stroke="#94a3b8" />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e2e8f0' }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                                    <Line type="monotone" dataKey="replies" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-500 text-sm">No campaign data yet</div>
                        )}
                    </div>
                </div>

                {/* Funnel Chart */}
                <div className="glass p-6 rounded-xl border border-white/10">
                    <h3 className="text-lg font-semibold mb-6 gradient-text">Email Funnel</h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0} minWidth={0}>
                            <BarChart data={funnelData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                                <XAxis type="number" stroke="#94a3b8" />
                                <YAxis dataKey="name" type="category" stroke="#94a3b8" width={80} />
                                <Tooltip
                                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px' }}
                                />
                                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KPICard({ title, value, icon }: { title: string; value: string | number; icon: string }) {
    return (
        <div className="glass p-6 rounded-xl border border-white/10 hover:border-blue-500/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
                <span className="text-gray-400 text-sm font-medium">{title}</span>
                <span className="text-xl">{icon}</span>
            </div>
            <div className="text-3xl font-bold text-white">{value ?? 0}</div>
        </div>
    );
}
