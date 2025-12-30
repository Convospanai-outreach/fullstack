"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Button } from "@/components/ui/Button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import ExportButton from "@/modules/data-export/ui/ExportButton";
import FilterBar from "@/components/shared/FilterBar";

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);

        fetch(`/api/campaigns?${params.toString()}`)
            .then((res) => res.json())
            .then((data) => {
                if (Array.isArray(data)) {
                    setCampaigns(data);
                } else {
                    console.error("Failed to fetch campaigns:", data);
                    setCampaigns([]);
                }
                setLoading(false);
            })
            .catch((err) => {
                console.error(err);
                setCampaigns([]);
                setLoading(false);
            });
    }, [search, statusFilter]);

    return (
        <div className="p-8 space-y-8">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="Campaigns"
                    subtitle="Manage your outreach sequences"
                />
                <div className="flex gap-4">
                    <ExportButton type="campaigns" />
                    <Link href="/campaigns/new">
                        <Button variant="primary">Create Campaign</Button>
                    </Link>
                </div>
            </div>

            <FilterBar
                onSearch={({ query, status }) => {
                    setSearch(query);
                    setStatusFilter(status || "");
                }}
                placeholder="Search campaigns..."
            />

            {loading ? (
                <div className="text-white/60">Loading campaigns...</div>
            ) : campaigns.length === 0 ? (
                <GlassCard className="text-center py-24 flex flex-col items-center justify-center border-dashed border-2 border-white/10 bg-white/5">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
                        <span className="text-4xl">🚀</span>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-2">Ready to Launch?</h3>
                    <p className="text-gray-400 mb-8 max-w-md">
                        Create your first AI-driven outreach campaign. We'll help you find leads, personalize emails, and schedule everything.
                    </p>
                    <Link href="/campaigns/new">
                        <Button variant="primary" className="px-8 py-4 text-lg shadow-lg shadow-blue-500/20 hover:scale-105 transition-transform">
                            Create First Campaign
                        </Button>
                    </Link>
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {campaigns.map((campaign) => (
                        <GlassCard key={campaign.id} className="p-6 space-y-4 hover:border-blue-500/50 transition-colors">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-semibold text-white">{campaign.name}</h3>
                                    <p className="text-sm text-white/60 line-clamp-2">{campaign.description || "No description"}</p>
                                </div>
                                <Badge variant={campaign.status === "active" ? "success" : "default"}>
                                    {campaign.status}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                                <div>
                                    <div className="text-xs text-white/40 uppercase tracking-wider">Target</div>
                                    <div className="text-xl font-mono text-white">{campaign._count?.leads || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs text-white/40 uppercase tracking-wider">Completed</div>
                                    <div className="text-xl font-mono text-white">{campaign.completedCount}</div>
                                </div>
                            </div>

                            <div className="pt-2 flex gap-2">
                                <Link href={`/dashboard/campaigns/${campaign.id}/edit`} className="w-full">
                                    <Button variant="outline" className="w-full">Edit</Button>
                                </Link>
                                <button className="p-2 rounded-lg border border-white/10 hover:bg-white/5 text-purple-300">
                                    ▶
                                </button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}
