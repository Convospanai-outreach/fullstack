"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { getLeads } from "@/lib/api/leads";
import {
    Users,
    UserPlus,
    Zap,
    Globe,
    MoreHorizontal,
    Mail,
    Linkedin,
    Search,
    ChevronDown,
    Command,
    Loader2
} from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/types/common";
import { cn } from "@/lib/utils";

const leadStatusLabels: Record<string, string> = {
    NEW: "NEW LEAD",
    enriched: "ENRICHED",
    ENRICHED: "ENRICHED",
    CONTACTED: "CONTACTED",
    CONNECTED: "ENGAGED",
    REPLIED: "POS REPLY",
    CONVERTED: "CONVERTED",
    LOST: "LOST",
    STOPPED: "STOPPED",
    LINKEDIN_CAPTURED: "LI CAPTURED",
    MULTI_CHANNEL_ENGAGED: "MC ENGAGED",
    MULTI_CHANNEL_CONTACTED: "MC CONTACTED",
    FOLLOW_UP_NEEDED: "FOLLOW UP",
};

const TIER_CONFIG: Record<string, { label: string; classes: string }> = {
    COLD:              { label: "COLD",          classes: "border-blue-500/30 text-blue-400 bg-blue-500/5" },
    WARM:              { label: "WARM",          classes: "border-amber-500/30 text-amber-400 bg-amber-500/5" },
    HOT:               { label: "HOT STATE",      classes: "border-rose-500/30 text-rose-400 bg-rose-500/5" },
    COORDINATING:      { label: "COORDINATING",  classes: "border-purple-500/30 text-purple-400 bg-purple-500/5" },
    MEETING_CONFIRMED: { label: "MEETING SET",   classes: "border-emerald-500/30 text-emerald-400 bg-emerald-500/5" },
    COMPLETED:         { label: "WON STATE",     classes: "border-green-500/30 text-green-400 bg-green-500/5" },
};

const transitionCurve = { type: "tween", ease: [0.16, 1, 0.3, 1], duration: 0.6 } as const;

function displayLeadStatus(status?: string) {
    if (!status) return "NEW STATE";
    return leadStatusLabels[status] ?? status.toUpperCase();
}

function TierBadge({ pipelineState }: { pipelineState?: string }) {
    if (!pipelineState || pipelineState === "COLD") return null;
    const cfg = TIER_CONFIG[pipelineState];
    if (!cfg) return null;
    return (
        <span className={cn(
            "text-[9px] font-mono tracking-wider border-[0.5px] px-1.5 py-0.5 select-none",
            cfg.classes
        )}>
            {cfg.label}
        </span>
    );
}

function channelBadgeLabel(channel: string, status: string) {
    if (channel === "EMAIL" && status === "CONTACTED") return "EMAIL SENT";
    if (channel === "LINKEDIN" && status === "CAPTURED") return "LI CAPTURED";
    if (channel === "LINKEDIN" && status === "DRAFTED") return "LI DRAFTED";
    if (channel === "LINKEDIN" && status === "CONTACTED") return "LI CONTACTED";
    if (status === "FOLLOW_UP") return "FOLLOW UP NEEDED";
    return `${channel} ${status}`.replaceAll("_", " ").toUpperCase();
}

function ChannelBadges({ statuses = [] }: { statuses?: Array<{ channel: string; status: string }> }) {
    if (!statuses.length) return null;
    return (
        <div className="flex flex-wrap gap-1">
            {statuses.map((item) => (
                <span
                    key={`${item.channel}-${item.status}`}
                    className="border-[0.5px] border-white/10 bg-white/2 px-1.5 py-0.5 text-[8.5px] font-mono tracking-widest text-zinc-400 uppercase select-none"
                >
                    {channelBadgeLabel(item.channel, item.status)}
                </span>
            ))}
        </div>
    );
}

export default function LeadsPage() {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [channelFilter, setChannelFilter] = useState("");
    const [search, setSearch] = useState("");
    const [enriching, setEnriching] = useState<Record<string, boolean>>({});
    const [selectedIndex, setSelectedIndex] = useState<number>(-1);

    const router = useRouter();

    useEffect(() => {
        loadLeads();
    }, [statusFilter, search, channelFilter]);

    const loadLeads = async () => {
        setLoading(true);
        setError("");
        try {
            const filters: any = {};
            if (statusFilter) filters.status = statusFilter;
            if (channelFilter) filters.channelFilter = channelFilter;
            if (search) filters.search = search;

            const data = await getLeads(filters);
            setLeads(data.leads || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load telemetry data");
        } finally {
            setLoading(false);
        }
    };

    const handleEnrich = async (id: string) => {
        setEnriching((prev) => ({ ...prev, [id]: true }));
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/leads/${id}/enrich`, { method: "POST" });
            if (!res.ok) throw new Error("Enrichment engine error");
            toast.success("Lead metadata enrichment complete");
            await loadLeads();
        } catch (error) {
            toast.error("Failed to enrich lead database entry");
        } finally {
            setEnriching((prev) => ({ ...prev, [id]: false }));
        }
    };

    // Keyboard Navigation (j/k)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (leads.length === 0) return;

            // Prevent input override
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            switch (e.key) {
                case 'j':
                    setSelectedIndex(prev => (prev < leads.length - 1 ? prev + 1 : prev));
                    break;
                case 'k':
                    setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev));
                    break;
                case 'Enter':
                    if (selectedIndex !== -1 && leads[selectedIndex]) {
                        router.push(`/leads/${leads[selectedIndex].id}`);
                    }
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [leads, selectedIndex, router]);

    // Scroll selected card into view
    useEffect(() => {
        if (selectedIndex !== -1) {
            const el = document.getElementById(`lead-card-${selectedIndex}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedIndex]);

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            {/* Header Block — Sleek Editorial Hierarchy */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-white/10 pb-6 gap-4">
                <div>
                    <h1 className="text-xl font-normal text-white font-outfit tracking-tight flex items-center gap-2">
                        <span className="text-zinc-600 font-mono text-sm">[01]</span>
                        Lead Registry
                    </h1>
                    <p className="text-[11px] text-zinc-400 mt-1 max-w-xl font-sans leading-relaxed">
                        Track customer signal captures, queue metadata enrichment states, and review automated outreach transitions.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Command Center Hints */}
                    <div className="hidden lg:flex items-center gap-2 text-[9px] text-zinc-500 font-mono bg-white/2 px-2.5 py-1.5 border border-white/5 uppercase tracking-wider">
                        <Command className="w-3 h-3 text-zinc-600" />
                        <span className="flex items-center gap-1"><kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-300">j</kbd> / <kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-300">k</kbd> scroll</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700 mx-1" />
                        <span className="flex items-center gap-1"><kbd className="bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-300">enter</kbd> open</span>
                    </div>

                    <Link href="/leads/import" id="import-csv-btn">
                        <button className="h-8 border border-white/10 bg-white/2 px-3 text-[11px] font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-2">
                            Import CSV
                        </button>
                    </Link>

                    <Link href="/leads/new" id="add-lead-btn">
                        <button className="h-8 bg-zinc-100 hover:bg-white px-3 text-[11px] font-medium text-zinc-950 transition-colors flex items-center gap-2">
                            <UserPlus className="w-3.5 h-3.5" />
                            Add Lead
                        </button>
                    </Link>
                </div>
            </div>

            {/* Industrial Custom Filter Console */}
            <div className="bg-[#030303] border-[0.5px] border-white/10 p-4 space-y-3">
                <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
                        <input
                            type="text"
                            placeholder="QUERY REGISTRY: Search by name, email, or domain..."
                            className="w-full bg-[#060606] border border-white/10 pl-9 pr-4 py-2 text-[12.5px] font-mono placeholder:text-zinc-600 text-zinc-200 outline-none focus:border-zinc-500 transition-colors"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            id="lead-search-input"
                        />
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative md:w-48">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full bg-[#060606] border border-white/10 px-3 py-2 text-[12px] font-mono text-zinc-300 outline-none appearance-none focus:border-zinc-500 transition-colors cursor-pointer"
                            id="lead-status-select"
                        >
                            <option value="">ALL STATUSES</option>
                            <option value="NEW">NEW STATE</option>
                            <option value="CONTACTED">CONTACTED</option>
                            <option value="CONNECTED">ENGAGED</option>
                            <option value="REPLIED">REPLIED</option>
                            <option value="INTERESTED">INTERESTED</option>
                            <option value="NOT_INTERESTED">NOT INTERESTED</option>
                        </select>
                        <ChevronDown className="absolute right-3 top-3 h-3 w-3 text-zinc-500 pointer-events-none" />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-500">Channel Mode</span>
                    <div className="relative">
                        <select
                            value={channelFilter}
                            onChange={(e) => setChannelFilter(e.target.value)}
                            className="bg-transparent text-[11px] font-mono text-zinc-400 outline-none appearance-none pr-6 cursor-pointer hover:text-zinc-200 transition-colors"
                            id="lead-channel-select"
                        >
                            <option value="" className="bg-[#030303] text-zinc-400">All outreach channels</option>
                            <option value="email_sent_linkedin_not_contacted" className="bg-[#030303] text-zinc-400">Email sent | LI uncontacted</option>
                            <option value="linkedin_captured_not_contacted" className="bg-[#030303] text-zinc-400">LI captured | Uncontacted</option>
                            <option value="multi_channel_contacted" className="bg-[#030303] text-zinc-400">Multi-channel contacted</option>
                            <option value="follow_up_needed" className="bg-[#030303] text-zinc-400">Requires manual follow-up</option>
                        </select>
                        <ChevronDown className="absolute right-0 top-1 h-3.5 w-3.5 text-zinc-500 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="border-[0.5px] border-rose-500/20 bg-rose-500/5 text-rose-400 px-4 py-3 text-[11px] font-mono uppercase tracking-wide flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    System Error: {error}
                </div>
            )}

            {/* Content Output */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="relative h-48 bg-[#030303] overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                        </div>
                    ))}
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center py-20 border-[0.5px] border-dashed border-white/15 bg-white/2 flex flex-col items-center justify-center">
                    <Users className="w-10 h-10 text-zinc-600 mb-4 stroke-[1]" />
                    <h3 className="text-sm font-normal text-zinc-300 font-outfit uppercase tracking-wider">No Leads Registered</h3>
                    <p className="text-[11px] text-zinc-500 mt-1 max-w-sm font-sans">
                        No active records match the current filter set. Import new targets via CSV or add a lead to get started.
                    </p>
                    <Link href="/leads/import" className="mt-6">
                        <button className="h-8 border border-white/10 px-4 text-[11px] font-medium text-zinc-300 hover:bg-white/5 transition-colors">
                            Import First Leads
                        </button>
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[1px] bg-white/10 border-[0.5px] border-white/10 p-[1px]">
                    <AnimatePresence mode="popLayout">
                        {leads.map((lead, index) => {
                            const isSelected = index === selectedIndex;
                            const leadInitials = lead.fullName?.[0] || lead.email?.[0]?.toUpperCase() || "?";
                            const pipelineState = (lead as any).pipelineState;
                            const channelStatuses = (lead as any).channelStatuses || [];
                            const intentScore = (lead as any).intentScore;

                            return (
                                <motion.div
                                    key={lead.id}
                                    id={`lead-card-${index}`}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    transition={transitionCurve}
                                    onClick={() => setSelectedIndex(index)}
                                    className={cn(
                                        "relative flex flex-col justify-between p-5 bg-[#030303] group hover:bg-[#070707] transition-colors duration-300 cursor-pointer focus:outline-none",
                                        isSelected ? "bg-[#06080a] ring-[1px] ring-zinc-500 z-10" : ""
                                    )}
                                    role="button"
                                    aria-label={`Lead ${lead.fullName || 'Unnamed'}`}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            router.push(`/leads/${lead.id}`);
                                        }
                                    }}
                                >
                                    {/* Selected Indicator Badge */}
                                    {isSelected && (
                                        <div className="absolute top-2 right-2 flex gap-1 z-20">
                                            <span className="bg-zinc-800 text-[8px] text-zinc-300 px-1.5 py-0.5 rounded font-mono uppercase tracking-widest">
                                                ENTER TO OPEN
                                            </span>
                                        </div>
                                    )}

                                    <div>
                                        {/* Card Header row */}
                                        <div className="flex justify-between items-start gap-2 mb-4">
                                            <div className="w-9 h-9 bg-white/2 border border-white/10 flex items-center justify-center text-zinc-400 font-mono text-xs select-none">
                                                {leadInitials}
                                            </div>
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-[9px] font-mono border-[0.5px] border-white/10 px-1.5 py-0.5 text-zinc-400 bg-white/2 uppercase tracking-wide">
                                                    {displayLeadStatus(lead.status)}
                                                </span>
                                                <TierBadge pipelineState={pipelineState} />
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="space-y-1">
                                            <h3 className="text-[13px] font-medium text-white group-hover:text-zinc-200 transition-colors truncate">
                                                {lead.fullName || "Unnamed Lead"}
                                            </h3>
                                            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                                                <Globe className="w-3 h-3 text-zinc-600" />
                                                <span className="truncate">{lead.company || "INDEPENDENT"}</span>
                                            </div>
                                        </div>

                                        <div className="mt-3">
                                            <ChannelBadges statuses={channelStatuses} />
                                        </div>
                                    </div>

                                    {/* Card Footer Section */}
                                    <div className="mt-6 pt-4 border-t border-white/5 space-y-3">
                                        {/* Intent Score Indicator */}
                                        {intentScore > 0 && (
                                            <div className="space-y-1">
                                                <div className="flex justify-between text-[9px] font-mono text-zinc-500 uppercase tracking-wider">
                                                    <span>Intent Index</span>
                                                    <span className="text-zinc-300">{Math.round(intentScore * 100)}%</span>
                                                </div>
                                                <div className="w-full bg-white/5 h-[2px]">
                                                    <div
                                                        className={cn(
                                                            "h-full transition-all duration-500",
                                                            intentScore >= 0.7 ? "bg-rose-500/80" :
                                                            intentScore >= 0.4 ? "bg-amber-500/80" : "bg-blue-500/80"
                                                        )}
                                                        style={{ width: `${Math.round(intentScore * 100)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 font-mono">
                                                <Mail className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                                                <span className="truncate">{lead.email}</span>
                                            </div>
                                            {lead.linkedIn && (
                                                <div className="flex items-center gap-2 text-[10.5px] text-zinc-400 font-mono">
                                                    <Linkedin className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                                                    <span className="truncate text-blue-400/80">LINKEDIN ACTIVE</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Row */}
                                    <div className="mt-5 flex gap-2">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleEnrich(lead.id);
                                            }}
                                            disabled={enriching[lead.id]}
                                            className={cn(
                                                "flex-1 h-8 flex items-center justify-center gap-1.5 text-[10px] font-mono uppercase tracking-wider transition-colors",
                                                lead.isEnriched
                                                    ? "bg-emerald-500/5 text-emerald-400 border border-emerald-500/20"
                                                    : "bg-white text-zinc-950 hover:bg-zinc-200 disabled:opacity-50"
                                            )}
                                        >
                                            {enriching[lead.id] ? (
                                                <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                                <Zap className="w-3 h-3" />
                                            )}
                                            {lead.isEnriched ? "ENRICHED" : "ENRICH"}
                                        </button>
                                        <button
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-8 h-8 flex items-center justify-center bg-white/2 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
                                            aria-label="More options"
                                        >
                                            <MoreHorizontal className="w-3.5 h-3.5" />
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
