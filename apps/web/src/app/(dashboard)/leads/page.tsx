"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getLeads } from "@/lib/api/leads";
import FilterBar from "@/components/shared/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Users,
    UserPlus,
    Zap,
    Globe,
    MoreHorizontal,
    Mail,
    Linkedin
} from "lucide-react";
import { toast } from "sonner";
import type { Lead } from "@/types/common";

const leadStatusLabels: Record<string, string> = {
    NEW: "New",
    enriched: "Enriched",
    ENRICHED: "Enriched",
    CONTACTED: "Contacted",
    CONNECTED: "Engaged",
    REPLIED: "Positive Reply",
    CONVERTED: "Converted",
    LOST: "Lost",
    STOPPED: "Stopped",
    LINKEDIN_CAPTURED: "LinkedIn Captured",
    MULTI_CHANNEL_ENGAGED: "Multi-channel Engaged",
    MULTI_CHANNEL_CONTACTED: "Multi-channel Contacted",
    FOLLOW_UP_NEEDED: "Follow-up Needed",
};

const TIER_CONFIG: Record<string, { label: string; classes: string }> = {
    COLD:              { label: "Cold",          classes: "bg-blue-500/10 text-blue-400 border border-blue-500/20" },
    WARM:              { label: "Warm",          classes: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
    HOT:               { label: "Hot",           classes: "bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse" },
    COORDINATING:      { label: "Coordinating",  classes: "bg-purple-500/10 text-purple-400 border border-purple-500/20" },
    MEETING_CONFIRMED: { label: "Meeting Set",   classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
    COMPLETED:         { label: "Won",           classes: "bg-green-500/10 text-green-400 border border-green-500/20" },
};

function displayLeadStatus(status?: string) {
    if (!status) return "New";
    return leadStatusLabels[status] ?? status;
}

function TierBadge({ pipelineState }: { pipelineState?: string }) {
    if (!pipelineState || pipelineState === "COLD") return null;
    const cfg = TIER_CONFIG[pipelineState];
    if (!cfg) return null;
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cfg.classes}`}>
            {cfg.label}
        </span>
    );
}

function channelBadgeLabel(channel: string, status: string) {
    if (channel === "EMAIL" && status === "CONTACTED") return "Email Sent";
    if (channel === "LINKEDIN" && status === "CAPTURED") return "LinkedIn Captured";
    if (channel === "LINKEDIN" && status === "DRAFTED") return "LinkedIn Drafted";
    if (channel === "LINKEDIN" && status === "CONTACTED") return "LinkedIn Contacted";
    if (status === "FOLLOW_UP") return "Follow-up Needed";
    return `${channel} ${status}`.replaceAll("_", " ");
}

function ChannelBadges({ statuses = [] }: { statuses?: Array<{ channel: string; status: string }> }) {
    if (!statuses.length) return null;
    return (
        <div className="mt-3 flex flex-wrap gap-1.5">
            {statuses.map((item) => (
                <span key={`${item.channel}-${item.status}`} className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/70">
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
            setLeads(data.leads);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load leads");
        } finally {
            setLoading(false);
        }
    };

    const handleEnrich = async (id: string) => {
        setEnriching((prev) => ({ ...prev, [id]: true }));
        try {
            const res = await fetch(`${process.env['NEXT_PUBLIC_API_URL']}/leads/${id}/enrich`, { method: "POST" });
            if (!res.ok) throw new Error("Enrichment failed");
            toast.success("Lead enriched successfully");
            await loadLeads();
        } catch (error) {
            toast.error("Failed to enrich lead");
        } finally {
            setEnriching((prev) => ({ ...prev, [id]: false }));
        }
    };

    const [selectedIndex, setSelectedIndex] = useState<number>(-1);
    const router = useRouter();

    // Keyboard Navigation (j/k)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (leads.length === 0) return;

            // Only hijack navigation if not typing in an input
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

    // Scroll selected item into view
    useEffect(() => {
        if (selectedIndex !== -1) {
            const el = document.getElementById(`lead-card-${selectedIndex}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [selectedIndex]);

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="Lead Review"
                    subtitle="Track enrichment, contact status, replies, and conversion."
                />

                {/* Keyboard Shortcut Hint */}
                <div className="hidden lg:flex items-center gap-4 text-xs text-gray-500 bg-white/5 px-4 py-2 rounded-lg border border-white/5">
                    <span className="flex items-center gap-1"><kbd className="bg-black/30 px-1.5 py-0.5 rounded text-gray-300 font-mono">j</kbd> next</span>
                    <span className="flex items-center gap-1"><kbd className="bg-black/30 px-1.5 py-0.5 rounded text-gray-300 font-mono">k</kbd> prev</span>
                    <span className="flex items-center gap-1"><kbd className="bg-black/30 px-1.5 py-0.5 rounded text-gray-300 font-mono">x</kbd> select</span>
                    <span className="flex items-center gap-1"><kbd className="bg-black/30 px-1.5 py-0.5 rounded text-gray-300 font-mono">enter</kbd> view</span>
                </div>

                <div className="flex gap-4">
                    <Link href="/leads/import">
                        <Button variant="outline" className="gap-2">
                            Import CSV
                        </Button>
                    </Link>
                    <Link href="/leads/new">
                        <Button variant="default" className="gap-2">
                            <UserPlus className="w-4 h-4" /> Add Lead
                        </Button>
                    </Link>
                </div>
            </div>

            <Card className="p-4 border-border">
                <FilterBar
                    onSearch={({ query, status }) => {
                        setSearch(query);
                        setStatusFilter(status || "");
                    }}
                    placeholder="Search leads by name, email, company, or status..."
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">Channel filter</span>
                    <select
                        value={channelFilter}
                        onChange={(event) => setChannelFilter(event.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                        <option value="">All channels</option>
                        <option value="email_sent_linkedin_not_contacted">Email sent but LinkedIn not contacted</option>
                        <option value="linkedin_captured_not_contacted">LinkedIn captured but not contacted</option>
                        <option value="multi_channel_contacted">Multi-channel contacted</option>
                        <option value="follow_up_needed">Follow-up needed</option>
                    </select>
                </div>
            </Card>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-center gap-3">
                    <Zap className="w-5 h-5" /> {error}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse border border-border" />
                    ))}
                </div>
            ) : leads.length === 0 ? (
                <GlassCard className="text-center py-24 border-dashed border-2 box-border shadow-none">
                    <Users className="w-16 h-16 text-muted-foreground mx-auto mb-6 opacity-20" />
                    <h3 className="text-xl font-bold text-muted-foreground">No leads found</h3>
                    <p className="text-muted-foreground mt-2 mb-8">Import ICP leads to enrich, review, contact, and track replies.</p>
                    <Link href="/leads/import">
                        <Button variant="default" className="px-8">Import your first leads</Button>
                    </Link>
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leads.map((lead, index) => (
                        <GlassCard
                            key={lead.id}
                            id={`lead-card-${index}`}
                            className={`p-6 transition-all group relative ${index === selectedIndex
                                ? "ring-2 ring-brand-500 ring-offset-2 ring-offset-background scale-[1.02]"
                                : "hover:shadow-clerk"
                                }`}
                            onClick={() => setSelectedIndex(index)}
                        >
                            {index === selectedIndex && (
                                <div className="absolute top-2 right-2 flex gap-1">
                                    <span className="bg-brand-600 text-[10px] text-white px-1.5 py-0.5 rounded font-mono">⏎ to open</span>
                                </div>
                            )}

                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/20 border border-border flex items-center justify-center text-brand-600 dark:text-brand-400 font-bold text-lg">
                                    {lead.fullName?.[0] || lead.email[0]?.toUpperCase() || '?'}
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <Badge variant={lead.status === 'enriched' ? 'success' : 'secondary'}>
                                        {displayLeadStatus(lead.status)}
                                    </Badge>
                                    <TierBadge pipelineState={(lead as any).pipelineState} />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-foreground group-hover:text-brand-600 transition-colors truncate">
                                    {lead.fullName || "Unnamed Lead"}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                    <Globe className="w-3.5 h-3.5" /> {lead.company || "Independent"}
                                </div>
                            </div>
                            <ChannelBadges statuses={(lead as any).channelStatuses || []} />

                            <div className="mt-6 pt-6 border-t border-border space-y-3">
                                {/* Intent Score Bar */}
                                {(lead as any).intentScore > 0 && (
                                    <div>
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                            <span>Intent Score</span>
                                            <span className="font-semibold">{Math.round((lead as any).intentScore * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-muted rounded-full h-1.5">
                                            <div
                                                className={`h-1.5 rounded-full transition-all ${
                                                    (lead as any).intentScore >= 0.7 ? 'bg-red-400' :
                                                    (lead as any).intentScore >= 0.4 ? 'bg-amber-400' : 'bg-blue-400'
                                                }`}
                                                style={{ width: `${Math.round((lead as any).intentScore * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                    <Mail className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    <span className="truncate">{lead.email}</span>
                                </div>
                                {lead.linkedIn && (
                                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                        <Linkedin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                        <span className="truncate">Active Profile</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex gap-2">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleEnrich(lead.id); }}
                                    disabled={enriching[lead.id]}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${lead.isEnriched
                                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border border-emerald-500/20"
                                        : "bg-brand-600 text-white hover:bg-brand-500 shadow-lg shadow-brand-900/20"
                                        } disabled:opacity-50`}
                                >
                                    {enriching[lead.id] ? <Zap className="w-3 h-3 animate-pulse" /> : <Zap className="w-3 h-3" />}
                                    {lead.isEnriched ? "Enriched" : "Enrich Lead"}
                                </button>
                                <button onClick={(e) => e.stopPropagation()} className="px-3 py-2 bg-muted border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all">
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}
        </div>
    );
}
