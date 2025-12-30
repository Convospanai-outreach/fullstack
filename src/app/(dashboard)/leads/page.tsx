"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getLeads } from "@/lib/api/leads";
import FilterBar from "@/components/shared/FilterBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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

export default function LeadsPage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [search, setSearch] = useState("");
    const [enriching, setEnriching] = useState<Record<string, boolean>>({});

    useEffect(() => {
        loadLeads();
    }, [statusFilter, search]);

    const loadLeads = async () => {
        setLoading(true);
        setError("");
        try {
            const filters: any = {};
            if (statusFilter) filters.status = statusFilter;
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
            const res = await fetch(`/api/leads/${id}/enrich`, { method: "POST" });
            if (!res.ok) throw new Error("Enrichment failed");
            toast.success("Lead enriched successfully");
            await loadLeads();
        } catch (error) {
            toast.error("Failed to enrich lead");
        } finally {
            setEnriching((prev) => ({ ...prev, [id]: false }));
        }
    };

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <SectionHeader
                    title="Leads"
                    subtitle="Centralized management for all your target prospects."
                />
                <div className="flex gap-4">
                    <Link href="/leads/import">
                        <Button variant="outline" className="gap-2">
                            Import CSV
                        </Button>
                    </Link>
                    <Link href="/leads/new">
                        <Button variant="primary" className="gap-2">
                            <UserPlus className="w-4 h-4" /> Add Lead
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                <FilterBar
                    onSearch={({ query, status }) => {
                        setSearch(query);
                        setStatusFilter(status || "");
                    }}
                    placeholder="Search prospects by name, email, or firm..."
                />
            </div>

            {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-center gap-3">
                    <Zap className="w-5 h-5" /> {error}
                </div>
            )}

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="h-48 bg-white/5 rounded-2xl animate-pulse border border-white/10" />
                    ))}
                </div>
            ) : leads.length === 0 ? (
                <GlassCard className="text-center py-24 border-dashed border-2">
                    <Users className="w-16 h-16 text-gray-700 mx-auto mb-6 opacity-20" />
                    <h3 className="text-xl font-bold text-gray-400">No prospects found</h3>
                    <p className="text-gray-500 mt-2 mb-8">Start your journey by importing leads or creating one manually.</p>
                    <Link href="/leads/import">
                        <Button variant="primary" className="px-8">Import your first leads</Button>
                    </Link>
                </GlassCard>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leads.map((lead) => (
                        <GlassCard key={lead.id} className="p-6 hover:translate-y-[-4px] transition-all group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-bold text-lg">
                                    {lead.fullName?.[0] || lead.email[0].toUpperCase()}
                                </div>
                                <div className="flex gap-2">
                                    <Badge variant={lead.status === 'enriched' ? 'success' : 'default'}>
                                        {lead.status}
                                    </Badge>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                                    {lead.fullName || "Unnamed Lead"}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                    <Globe className="w-3.5 h-3.5" /> {lead.company || "Independent"}
                                </div>
                            </div>

                            <div className="mt-6 pt-6 border-t border-white/5 space-y-3">
                                <div className="flex items-center gap-3 text-sm text-gray-400">
                                    <Mail className="w-4 h-4 text-purple-400" />
                                    <span className="truncate">{lead.email}</span>
                                </div>
                                {lead.linkedIn && (
                                    <div className="flex items-center gap-3 text-sm text-gray-400">
                                        <Linkedin className="w-4 h-4 text-blue-400" />
                                        <span className="truncate">Active Profile</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex gap-2">
                                <button
                                    onClick={() => handleEnrich(lead.id)}
                                    disabled={enriching[lead.id]}
                                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${lead.isEnriched
                                        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                                        : "bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20"
                                        } disabled:opacity-50`}
                                >
                                    {enriching[lead.id] ? <Zap className="w-3 h-3 animate-pulse" /> : <Zap className="w-3 h-3" />}
                                    {lead.isEnriched ? "Verified" : "AI Enrich"}
                                </button>
                                <button className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all">
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
