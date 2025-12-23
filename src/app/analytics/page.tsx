"use client";

import React, { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { CampaignPerformanceChart } from "@/components/analytics/CampaignPerformanceChart";
import { LeadGrowthChart } from "@/components/analytics/LeadGrowthChart";

import OrgGraph from "@/modules/analytics/components/OrgGraph";

export default function AnalyticsPage() {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/analytics/stats")
            .then((res) => res.json())
            .then((data) => {
                setData(data);
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setLoading(false);
            });
    }, []);

    if (loading) return <div className="p-8 text-white/60">Loading analytics...</div>;

    return (
        <div className="p-8 space-y-8 max-w-7xl mx-auto">
            <SectionHeader title="Analytics" subtitle="Insights into your outreach performance" />

            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <GlassCard className="p-6">
                    <div className="text-gray-400 text-sm mb-1">Total Leads</div>
                    <div className="text-3xl font-bold text-white">{data.totalLeads}</div>
                </GlassCard>
                <GlassCard className="p-6">
                    <div className="text-gray-400 text-sm mb-1">Active Campaigns</div>
                    <div className="text-3xl font-bold text-white">{data.activeCampaigns}</div>
                </GlassCard>
                <GlassCard className="p-6">
                    <div className="text-gray-400 text-sm mb-1">Response Rate</div>
                    <div className="text-3xl font-bold text-green-400">{data.responseRate}</div>
                </GlassCard>
            </div>

            {/* Funnel & Org Graph */}
            <div className="grid grid-cols-1 gap-8">
                <div className="bg-slate-900 border border-white/10 p-6 rounded-2xl">
                    <h2 className="text-xl font-bold mb-4">Organization Map</h2>
                    <OrgGraph />
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <CampaignPerformanceChart data={data.campaignPerformance} />
                <LeadGrowthChart data={data.leadGrowth} />
            </div>
        </div>
    );
}
