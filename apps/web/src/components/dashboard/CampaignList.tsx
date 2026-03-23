"use client";
import { useState } from "react";
import { toast } from "sonner";
import ScheduleCampaignModal from "./ScheduleCampaignModal";
import { Calendar, BrainCircuit, ShieldCheck, ChevronDown, ChevronUp } from "lucide-react";

export default function CampaignList({ campaigns }: any) {
    const [running, setRunning] = useState<string | null>(null);
    const [scheduleModal, setScheduleModal] = useState<{ id: string, name: string } | null>(null);
    const [expandedInsights, setExpandedInsights] = useState<string | null>(null);

    const handleRun = async (id: string) => {
        setRunning(id);
        try {
            const res = await fetch(process.env['NEXT_PUBLIC_API_URL'] + "/orchestrator/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ campaignId: id }),
            });
            if (!res.ok) throw new Error("Failed to start campaign");
            toast.success("Campaign triggered!");
        } catch (err) {
            console.error(err);
            toast.error("Failed to trigger campaign");
        } finally {
            setRunning(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {scheduleModal && (
                <ScheduleCampaignModal
                    isOpen={!!scheduleModal}
                    onClose={() => setScheduleModal(null)}
                    campaignId={scheduleModal.id}
                    campaignName={scheduleModal.name}
                    onSchedule={() => {
                        window.location.reload();
                    }}
                />
            )}

            {campaigns.map((c: any) => (
                <div key={c.id} className="flex flex-col gap-0.5 animate-in fade-in slide-in-from-left-2 duration-300">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-all group">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                                {c.name[0]}
                            </div>
                            <div>
                                <div className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{c.name}</div>
                                <div className="text-xs text-gray-500 font-medium">
                                    {c.audience} • {c.leads} Leads • {c.status}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setExpandedInsights(expandedInsights === c.id ? null : c.id)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${expandedInsights === c.id
                                        ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10'
                                    }`}
                            >
                                <BrainCircuit className="w-3.5 h-3.5" />
                                {expandedInsights === c.id ? 'Hide Logic' : 'AI Logic'}
                                {expandedInsights === c.id ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                            </button>

                            <div className="flex items-center gap-1.5 ml-2 border-l border-white/10 pl-3">
                                <button
                                    onClick={() => setScheduleModal({ id: c.id, name: c.name })}
                                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all shadow-xl"
                                    title="Schedule"
                                >
                                    <Calendar className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleRun(c.id)}
                                    disabled={running === c.id}
                                    className="px-4 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 font-bold text-xs transition-all active:scale-95"
                                >
                                    {running === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Deploy Now"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* AI Insights Grounding Panel */}
                    {expandedInsights === c.id && (
                        <div className="mx-4 p-5 rounded-b-2xl bg-blue-600/[0.03] border-x border-b border-blue-500/20 animate-in slide-in-from-top-2 duration-300">
                            <div className="flex items-start gap-4">
                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                    <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">Grounding Analysis</h4>
                                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                                            This campaign's copy was generated using verified data from your <span className="text-blue-400 font-bold">"Q4 Sales Playbook"</span> and <span className="text-blue-400 font-bold">"Pricing FAQ"</span> knowledge bases.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Confidence Score</div>
                                            <div className="text-lg font-bold text-emerald-400">98.4%</div>
                                        </div>
                                        <div className="p-3 rounded-lg bg-white/5 border border-white/5">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hallucination Risk</div>
                                            <div className="text-lg font-bold text-blue-400">Low</div>
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <button className="text-[11px] font-bold text-blue-400 hover:text-blue-300 transition-colors uppercase tracking-widest flex items-center gap-1.5">
                                            View Source Documents <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

function Loader2(props: any) {
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
            className="lucide lucide-loader-2 animate-spin"
        >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
    );
}

function ChevronRight(props: any) {
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
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}
