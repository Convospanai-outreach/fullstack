
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
                score: null,
                level: "EVALUATING",
                canAutoSend: false,
                requiresApproval: true,
                features: ["human_review_mode", "audit_logging"],
                narrative: "Trust score calculation active. Human review mode enforced for new campaign activity."
            });
            setLoading(false);
        };
        simulateLoad();
    }, [teamId]);

    if (loading) return <div>Loading Governance...</div>;

    return (
        <div className="glass-panel p-6 rounded-2xl border border-foreground/5 space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
                    <Shield className="w-6 h-6 text-success" />
                    Workspace Health
                </h3>
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${metrics.score ? (metrics.score > 80 ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive') : 'bg-foreground/10 text-foreground/70'}`}>
                    Trust Score: {metrics.score ?? "Pending"}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-foreground/5 p-4 rounded-xl border border-foreground/5">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-2 flex items-center gap-1">
                        <TrendingUp className="w-3 h-3" /> Status
                    </div>
                    <div className="text-lg text-foreground font-bold">{metrics.level} TRUST</div>
                    <p className="text-[10px] text-muted-foreground mt-1">{metrics.narrative}</p>
                </div>

                <div className="bg-foreground/5 p-4 rounded-xl border border-foreground/5">
                    <div className="text-xs text-muted-foreground uppercase font-bold mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Restrictions
                    </div>
                    <div className="text-sm text-foreground">
                        {metrics.canAutoSend ? "✅ Autopulse Active" : "⚠️ Approval Required"}
                    </div>
                </div>
            </div>

            {/* Task 4: XAI-Lite Component */}
            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                        <div className="text-sm font-bold text-foreground">Explainable AI (Lite)</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Current generation logic is tuned to prioritized <strong>Outcome-Weighted RAG</strong>.
                            Patterns are derived from 42 successful replies in your industry.
                        </p>
                    </div>
                </div>
            </div>

            {/* Task 8: Progressive Disclosure Feature Gating */}
            <div className="pt-4 border-t border-foreground/5">
                <div className="text-xs text-muted-foreground font-bold mb-3 uppercase">Unlocked Capabilities</div>
                <div className="flex flex-wrap gap-2">
                    {metrics.features.map((f: string) => (
                        <span key={f} className="text-[10px] bg-foreground/5 text-foreground/80 px-2 py-1 rounded-md border border-foreground/10 uppercase tracking-widest">
                            {f.replace("_", " ")}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
}
