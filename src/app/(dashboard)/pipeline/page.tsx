"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    MoreVertical,
    Sparkles,
    ArrowRight,
    Clock,
    DollarSign,
    Zap
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const STAGES = ["NEW", "QUALIFIED", "CONTACTED", "MEETING", "PROPOSAL", "WON"];

export default function PipelinePage() {
    const [leads, setLeads] = useState<any[]>([]);
    const [stats, setStats] = useState<any>({ totalValue: 0 });
    const [loading, setLoading] = useState(true);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [leadsRes, statsRes] = await Promise.all([
                fetch(process.env['NEXT_PUBLIC_API_URL'] + "/leads"),
                fetch(process.env['NEXT_PUBLIC_API_URL'] + "/pipeline/stats")
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
            fetch(process.env['NEXT_PUBLIC_API_URL'] + "/pipeline/ai/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ leadId, action: "suggestTasks" })
            }).then(async r => {
                const data = await r.json();
                setAiSuggestions(data.data || []);
                return data.data;
            }),
            {
                loading: 'AI is analyzing conversation history...',
                success: 'Tasks suggested!',
                error: 'AI analysis failed',
            }
        );
    };

    if (loading) return <div className="flex p-20 justify-center"><Sparkles className="animate-spin text-blue-500" /></div>;

    return (
        <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header / Stats */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        Sales Pipeline <Sparkles className="w-6 h-6 text-purple-400" />
                    </h1>
                    <p className="text-gray-400 mt-1">Manage your deals and track conversion across stages.</p>
                </div>
                <div className="flex gap-4">
                    <div className="glass-panel px-6 py-3 rounded-2xl flex items-center gap-4 border border-white/5">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-widest">Pipeline Value</div>
                            <div className="text-xl font-bold text-white">${stats.totalValue?.toLocaleString() || 0}</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Board */}
            <div className="flex gap-6 overflow-x-auto pb-8 custom-scrollbar min-h-[70vh]">
                {STAGES.map(stage => (
                    <div key={stage} className="min-w-[320px] flex-1 flex flex-col gap-4">
                        <div className="flex items-center justify-between px-2">
                            <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${stage === 'WON' ? 'bg-emerald-500' : 'bg-blue-400'
                                    }`} />
                                <h3 className="font-bold text-xs uppercase tracking-widest text-gray-400">{stage}</h3>
                                <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-full text-gray-500">
                                    {leads.filter(l => l.status === stage).length}
                                </span>
                            </div>
                            <button className="text-gray-600 hover:text-white" title="Stage options"><MoreVertical className="w-4 h-4" /></button>
                        </div>

                        <div className="flex-1 flex flex-col gap-3 rounded-2xl bg-white/[0.02] p-2 border border-white/5">
                            {leads.filter(l => l.status === stage).map(lead => (
                                <div
                                    key={lead.id}
                                    className="glass-panel p-4 rounded-xl border border-white/10 hover:border-white/20 transition-all group relative cursor-pointer active:scale-95"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xs font-bold shadow-lg">
                                            {lead.fullName?.[0] || 'L'}
                                        </div>
                                        <div className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">
                                            ${lead.value || 0}
                                        </div>
                                    </div>

                                    <div className="font-bold text-white text-sm mb-1">{lead.fullName}</div>
                                    <div className="text-xs text-gray-500 mb-4">{lead.company}</div>

                                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); analyzeLead(lead.id); }}
                                                className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-all opacity-0 group-hover:opacity-100"
                                                title="AI Analyze"
                                            >
                                                <Zap className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] text-gray-600 font-medium">
                                            <Clock className="w-3 h-3" /> {formatDistanceToNow(new Date(lead.updatedAt))} ago
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <button className="py-3 items-center justify-center flex gap-2 text-[10px] font-bold text-gray-600 hover:text-gray-400 uppercase tracking-widest border border-dashed border-white/5 rounded-xl hover:bg-white/[0.02] transition-all" title="Add lead to stage">
                                <Plus className="w-3 h-3" /> Add Lead
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Assistance Overlay (if suggestions exist) */}
            {aiSuggestions.length > 0 && (
                <div className="fixed bottom-10 right-10 w-80 glass-panel p-6 border border-purple-500/30 shadow-2xl shadow-purple-900/40 animate-in slide-in-from-right-full duration-500 z-50">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                            <Sparkles className="w-4 h-4" /> AI Recommendations
                        </div>
                        <button onClick={() => setAiSuggestions([])} className="text-gray-500 hover:text-white" title="Close"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-4">
                        {aiSuggestions.map((s, i) => (
                            <div key={i} className="p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all cursor-pointer">
                                <div className="text-xs font-bold text-white mb-1">{s.title}</div>
                                <div className="text-[10px] text-gray-400">{s.description}</div>
                                <div className="mt-2 flex items-center justify-between">
                                    <span className="text-[8px] uppercase font-bold text-purple-500 px-1.5 py-0.5 bg-purple-500/10 rounded">{s.priority}</span>
                                    <button className="text-[10px] font-bold text-blue-400 flex items-center gap-1 hover:underline">
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
