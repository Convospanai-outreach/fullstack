
"use client";

import { useState, useEffect } from "react";
import { Shield, TrendingUp, AlertTriangle, Info } from "lucide-react";

export function TrustDashboard({ teamId }: { teamId: string }) {
    const [metrics, setMetrics] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // In real app, this would be an API call to TrustEngine.getTrustMetrics
        const simulateLoad = async () => {
            setMetrics({
                score: 92,
                level: "HIGH",
                canAutoSend: true,
                requiresApproval: false,
                features: ["auto_outreach", "bulk_tasks", "causal_insights"],
                narrative: "Your trust score is high due to consistent human approval and zero bounce violations."
            });
            setLoading(false);
        };
        simulateLoad();
    }, [teamId]);

    if (loading) return <div>Loading Governance...</div>;

    return (
        <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Shield className="w-6 h-6 text-emerald-400" />
                    Workspace Health
                </h3>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${metrics.score > 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    Trust Score: {metrics.score}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Status
                    </div>
                    <div className="text-lg text-white font-bold">{metrics.level} TRUST</div>
                    <p className="text-[10px] text-gray-400 mt-1">{metrics.narrative}</p>
                </div>

                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Restrictions
                    </div>
                    <div className="text-sm text-white">
                        {metrics.canAutoSend ? "✅ Autopulse Active" : "⚠️ Approval Required"}
                    </div>
                </div>
            </div>

            {/* Task 4: XAI-Lite Component */}
            <div className="bg-blue-500/5 p-4 rounded-xl border border-blue-500/10">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                        <div className="text-sm font-bold text-white">Explainable AI (Lite)</div>
                        <p className="text-xs text-gray-400 mt-1">
                            Current generation logic is tuned to prioritized <strong>Outcome-Weighted RAG</strong>.
                            Patterns are derived from 42 successful replies in your industry.
                        </p>
                    </div>
                </div>
            </div>

            {/* Task 8: Progressive Disclosure Feature Gating */}
            <div className="pt-4 border-t border-white/5">
                <div className="text-xs text-gray-500 font-bold mb-3 uppercase">Unlocked Capabilities</div>
                <div className="flex flex-wrap gap-2">
                    {metrics.features.map((f: string) => (
                        <span key={f} className="text-[10px] bg-white/5 text-gray-300 px-2 py-1 rounded-md border border-white/10 uppercase tracking-widest">
                            {f.replace("_", " ")}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
