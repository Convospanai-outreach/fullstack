"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
    Megaphone,
    Search,
    ChevronDown,
    Loader2,
    Play,
    Pause,
    Plus,
    FileSpreadsheet
} from "lucide-react";
import type { Campaign } from "@/types/common";
import { getBrowserApiUrl } from "@/lib/api/browserBase";
import { cn } from "@/lib/utils";
import ExportButton from "@/modules/data-export/ui/ExportButton";

const transitionCurve = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.6 } as const;

export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [toggling, setToggling] = useState<Record<string, boolean>>({});

    useEffect(() => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set("search", search);
        if (statusFilter) params.set("status", statusFilter);

        fetch(getBrowserApiUrl(`/campaigns?${params.toString()}`))
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

    const handleToggleStatus = async (id: string, currentStatus: string) => {
        setToggling(prev => ({ ...prev, [id]: true }));
        const nextStatus = currentStatus === "active" ? "paused" : "active";
        try {
            const res = await fetch(getBrowserApiUrl(`/campaigns/${id}`), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: nextStatus })
            });
            if (!res.ok) throw new Error("Status transition failed");
            
            setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus } : c));
        } catch (e) {
            console.error("Failed to transition status:", e);
        } finally {
            setToggling(prev => ({ ...prev, [id]: false }));
        }
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Header Block — Industrial Typography */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-xl font-normal text-white font-outfit tracking-tight flex items-center gap-2">
                        <span className="text-zinc-600 font-mono text-sm">[02]</span>
                        Outreach Campaigns
                    </h1>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-xl font-sans leading-relaxed">
                        Deploy customer outreach sequences, monitor execution telemetry, and manage automated workflow configurations.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <ExportButton type="campaigns" />

                    <Link href="/campaigns/new" id="create-campaign-btn">
                        <button className="h-8 bg-zinc-100 hover:bg-white px-3 text-[11px] font-medium text-zinc-950 transition-colors flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            Create Campaign
                        </button>
                    </Link>
                </div>
            </div>

            {/* Custom Filter Console */}
            <div className="bg-[#030303] border-[0.5px] border-white/10 p-4 flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                    <input
                        type="text"
                        placeholder="QUERY SEQUENCES: Search by campaign name or description..."
                        className="w-full bg-[#060606] border border-white/10 pl-9 pr-4 py-2 text-[12.5px] font-mono placeholder:text-zinc-600 text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        id="campaign-search-input"
                    />
                </div>

                {/* Status selector */}
                <div className="relative md:w-48">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full bg-[#060606] border border-white/10 px-3 py-2 text-[12px] font-mono text-zinc-300 outline-none appearance-none focus:border-zinc-500 transition-colors cursor-pointer"
                        id="campaign-status-select"
                    >
                        <option value="">ALL CAMPAIGNS</option>
                        <option value="active">ACTIVE ONLY</option>
                        <option value="paused">PAUSED ONLY</option>
                        <option value="draft">DRAFTS ONLY</option>
                    </select>
                    <ChevronDown className="absolute right-3 top-3 h-3 w-3 text-zinc-500 pointer-events-none" />
                </div>
            </div>

            {/* Content Output */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="relative h-48 bg-[#030303] overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        </div>
                    ))}
                </div>
            ) : campaigns.length === 0 ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2 flex flex-col items-center justify-center">
                    <Megaphone className="w-10 h-10 text-zinc-600 mb-4 stroke-[1]" />
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">No Campaigns Found</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm font-sans">
                        No sequences matches your search criteria. Create an outreach campaign to start queueing contacts.
                    </p>
                    <Link href="/campaigns/new" className="mt-6">
                        <button className="h-8 border border-white/10 px-4 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors">
                            Configure First Campaign
                        </button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    <AnimatePresence mode="popLayout">
                        {campaigns.map((campaign, index) => {
                            const isActive = campaign.status === "active";
                            const leadCount = campaign._count?.leads || 0;
                            const completedCount = campaign.completedCount || 0;
                            const completionRate = leadCount > 0 ? Math.round((completedCount / leadCount) * 100) : 0;

                            return (
                                <motion.div
                                    key={campaign.id}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={transitionCurve}
                                    className="relative flex flex-col justify-between p-5 bg-[#030303] group hover:bg-[#070707] transition-colors duration-300 border-[0.5px] border-transparent hover:border-white/5"
                                >
                                    <div>
                                        {/* Status Header row */}
                                        <div className="flex justify-between items-center gap-2 mb-4">
                                            <span className="text-[8px] font-mono text-zinc-500 tracking-widest select-none">
                                                CAMPAIGN 0{index + 1}
                                            </span>
                                            <span className={cn(
                                                "text-[9px] font-mono border-[0.5px] px-1.5 py-0.5 uppercase tracking-wider",
                                                isActive
                                                    ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5"
                                                    : "border-zinc-500/20 text-zinc-400 bg-zinc-500/5"
                                            )}>
                                                {campaign.status.toUpperCase()}
                                            </span>
                                        </div>

                                        {/* Title and Description */}
                                        <div className="space-y-1">
                                            <h3 className="text-[13px] font-medium text-white group-hover:text-zinc-200 transition-colors truncate">
                                                {campaign.name}
                                            </h3>
                                            <p className="text-[11px] text-zinc-400 font-sans line-clamp-2 leading-relaxed min-h-[32px]">
                                                {campaign.description || "No description configured."}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Metrics Grid */}
                                    <div className="mt-6 pt-4 border-t border-white/5 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500">Target Size</span>
                                                <div className="text-sm font-mono text-zinc-200">{leadCount}</div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-500">Processed</span>
                                                <div className="text-sm font-mono text-zinc-200">{completedCount}</div>
                                            </div>
                                        </div>

                                        {/* Completion Bar */}
                                        <div className="space-y-1">
                                            <div className="flex justify-between text-[8px] font-mono text-zinc-500 uppercase tracking-wider">
                                                <span>Pipeline Completion</span>
                                                <span className="text-zinc-300">{completionRate}%</span>
                                            </div>
                                            <div className="w-full bg-white/5 h-[2px]">
                                                <div
                                                    className="h-full bg-zinc-400 transition-all duration-500"
                                                    style={{ width: `${completionRate}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="mt-5 flex gap-2">
                                        <Link href={`/campaigns/${campaign.id}/edit`} className="flex-1">
                                            <button className="w-full h-8 flex items-center justify-center text-[10px] font-mono uppercase tracking-wider border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 transition-colors">
                                                Edit
                                            </button>
                                        </Link>

                                        <button
                                            onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                                            disabled={toggling[campaign.id]}
                                            className={cn(
                                                "w-8 h-8 flex items-center justify-center bg-white/2 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors",
                                                toggling[campaign.id] ? "opacity-50" : ""
                                            )}
                                            aria-label={isActive ? "Pause campaign" : "Resume campaign"}
                                        >
                                            {toggling[campaign.id] ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : isActive ? (
                                                <Pause className="w-3.5 h-3.5" />
                                            ) : (
                                                <Play className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    );
}
