"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
    Plus,
    Sparkles,
    ArrowRight,
    Clock,
    DollarSign,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

const STAGES = ["COLD", "WARM", "HOT", "COORDINATING", "MEETING_CONFIRMED", "COMPLETED"];

const STAGE_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
    COLD:             { color: "text-primary",     dot: "bg-primary",     label: "Cold" },
    WARM:             { color: "text-warning",     dot: "bg-warning",     label: "Warm" },
    HOT:              { color: "text-destructive", dot: "bg-destructive", label: "Hot 🔥" },
    COORDINATING:     { color: "text-purple-500",  dot: "bg-purple-500",  label: "Coordinating" },
    MEETING_CONFIRMED:{ color: "text-success",     dot: "bg-success",     label: "Meeting Booked" },
    COMPLETED:        { color: "text-success",     dot: "bg-success",     label: "Completed ✓" },
};

export default function PipelinePage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ totalValue: 0 });
    const [loading, setLoading] = useState(true);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
    const [aiSuggestionsLeadId, setAiSuggestionsLeadId] = useState<string | null>(null);
    const [acceptingIndex, setAcceptingIndex] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [leadsRes, statsRes] = await Promise.all([
                fetch(getBrowserApiUrl("/leads")),
                fetch(getBrowserApiUrl("/pipeline/stats"))
            ]);

            const leadsData = await leadsRes.json();
            const statsData = await statsRes.json();

            setLeads(leadsData.data?.leads || []);
            setStats(statsData.data || { totalValue: 0 });
        } catch (error) {
            toast.error("Failed to load pipeline data");
        } finally {
            setLoading(false);
        }
    };

    const analyzeLead = async (leadId: string) => {
        toast.promise(
            fetch(getBrowserApiUrl("/pipeline/ai/analyze"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, action: "suggestTasks" })
            }).then(async r => {
                const data = await r.json();
                setAiSuggestions(data.data || []);
                setAiSuggestionsLeadId(leadId);
                return data.data;
            }),
            {
                loading: 'AI is analyzing conversation history...',
                success: 'Tasks suggested!',
                error: 'AI analysis failed',
            }
        );
    };

    const acceptSuggestion = async (suggestion: any, index: number) => {
        if (!aiSuggestionsLeadId) return;
        setAcceptingIndex(index);
        try {
            const res = await fetch(getBrowserApiUrl("/pipeline/tasks"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    leadId: aiSuggestionsLeadId,
                    title: suggestion.title,
                    description: suggestion.description,
                    priority: String(suggestion.priority || "medium").toUpperCase(),
                }),
            });
            if (!res.ok) throw new Error("Failed to create task");
            toast.success("Task created");
            setAiSuggestions(prev => prev.filter((_, i) => i !== index));
        } catch (error) {
            toast.error("Failed to accept suggestion");
        } finally {
            setAcceptingIndex(null);
        }
    };

    if (loading) return <div className="flex p-20 justify-center"><Sparkles className="animate-spin text-primary" /></div>;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header / Stats */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
                        Sales Pipeline <Sparkles className="w-6 h-6 text-purple-500" />
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage your deals and track conversion across stages.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-card p-4 rounded-lg flex items-center gap-4 border border-border/50">
                        <div className="w-10 h-10 rounded-md bg-success/10 flex items-center justify-center text-success">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pipeline Value</div>
                            <div className="text-xl font-bold text-foreground">${stats.totalValue?.toLocaleString() || 0}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Board */}
            <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar min-h-[70vh]">
                {STAGES.map(stage => {
                    const cfg = STAGE_CONFIG[stage];
                    const stageLeads = leads.filter(l => (l.pipelineState || "COLD") === stage);
                    return (
                    <div key={stage} className="min-w-[320px] flex-1 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                <h3 className={`font-bold text-xs uppercase tracking-widest ${cfg.color}`}>{cfg.label}</h3>
                                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                                    {stageLeads.length}
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 rounded-lg bg-card/50 p-2 border border-border/50">
                            {stageLeads.map(lead => {
                                const score = lead.intentScore ?? 0;
                                const scorePct = Math.round(score * 100);
                                const tier: string = lead.pipelineState || "COLD";
                                const tierCfg = STAGE_CONFIG[tier] || STAGE_CONFIG["COLD"];
                                return (
                                <div
                                    key={lead.id}
                                    className="bg-card p-4 rounded-xl border border-border hover:border-primary/30 transition-all group relative cursor-pointer active:scale-95"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-lg">
                                            {lead.fullName?.[0] || 'L'}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {scorePct > 0 && (
                                                <span className={`text-[10px] font-bold ${tierCfg.color} bg-muted px-2 py-0.5 rounded`}>
                                                    {scorePct}% intent
                                                </span>
                                            )}
                                            <div className="text-[10px] font-bold text-success bg-success/10 px-2 py-0.5 rounded">
                                                ${lead.value || 0}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="font-bold text-foreground text-sm mb-1">{lead.fullName}</div>
                                    <div className="text-xs text-muted-foreground mb-2">{lead.company}</div>

                                    {/* Intent score bar */}
                                    {scorePct > 0 && (
                                        <div className="w-full bg-muted rounded-full h-1 mb-3">
                                            <div
                                                className={`h-1 rounded-full transition-all ${
                                                    scorePct >= 70 ? 'bg-destructive' : scorePct >= 40 ? 'bg-warning' : 'bg-primary'
                                                }`}
                                                style={{ width: `${scorePct}%` }}
                                            />
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-3 border-t border-border">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); analyzeLead(lead.id); }}
                                                className="p-1.5 rounded-lg bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="AI Analyze"
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium">
                                            <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(lead.updatedAt))} ago
                                        </div>
                                    </div>
                                </div>
                                );
                            })}
                            <Link
                                href={`/leads/new?stage=${stage}`}
                                className="py-3 items-center justify-center flex gap-2 text-[10px] font-bold text-muted-foreground hover:text-foreground uppercase tracking-widest border border-dashed border-border rounded-xl hover:bg-accent transition-all"
                                title="Add lead to stage"
                            >
                                <Plus className="w-3 h-3" /> Add Lead
                            </Link>
                        </div>
                    </div>
                    );
                })}
            </div>

            {/* AI Assistance Overlay (if suggestions exist) */}
            {aiSuggestions.length > 0 && (
                <div className="fixed bottom-10 right-10 w-80 bg-card p-6 border border-purple-500/30 rounded-xl shadow-2xl animate-in slide-in-from-right-full duration-500 z-50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-purple-500 font-bold text-sm">
                            <Sparkles className="w-4 h-4" /> AI Recommendations
                        </div>
                        <button onClick={() => setAiSuggestions([])} className="text-muted-foreground hover:text-foreground" title="Close"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-4">
                        {aiSuggestions.map((s, i) => (
                            <div key={i} className="p-3 bg-muted rounded-xl border border-border hover:bg-accent transition-all cursor-pointer">
                                <div className="text-xs font-bold text-foreground mb-1">{s.title}</div>
                                <div className="text-[10px] text-muted-foreground">{s.description}</div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[8px] uppercase font-bold text-purple-500 px-1.5 py-0.5 bg-purple-500/10 rounded">{s.priority}</span>
                                    <button
                                        onClick={() => acceptSuggestion(s, i)}
                                        disabled={acceptingIndex === i}
                                        className="text-[10px] font-bold text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
                                    >
                                        Accept <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function X(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    )
}
