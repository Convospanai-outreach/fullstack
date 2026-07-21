"use client";

import { useState, useEffect } from "react";
// import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { 
    Flame, 
    TrendingUp, 
    Clock, 
    Sparkles, 
    Activity, 
    BrainCircuit,
    Smartphone,
    Mail,
    User
} from "lucide-react";

interface QueueItem {
    id: string; // queue id
    status: string;
    lead: {
        id: string;
        fullName: string;
        phone: string;
        company: string;
        email: string;
        threads: any[];
        intentScore?: number;
        leadScore?: number;
        pipelineState?: string;
        clusterLabel?: string;
        churnRisk?: number;
        optimalSendHour?: number;
        hotAt?: string;
    }
}

export default function CallerPage() {
    // const { data: session } = useSession();
    const [assigned, setAssigned] = useState<QueueItem[]>([]);
    const [pool, setPool] = useState<QueueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Active Focus State
    const [activeLead, setActiveLead] = useState<QueueItem | null>(null);
    const [notes, setNotes] = useState("");

    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/caller/queue");
            if (res.ok) {
                const data = await res.json();
                setAssigned(data.assigned);
                setPool(data.pool);

                // Auto-select first assigned if available
                if (data.assigned.length > 0 && !activeLead) {
                    setActiveLead(data.assigned[0]);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQueue();
    }, []);

    const handleClaim = async (leadId: string) => {
        setProcessingId(leadId);
        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/caller/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "claim", leadId })
            });
            if (res.ok) {
                await fetchQueue();
            }
        } finally {
            setProcessingId(null);
        }
    };

    const handleOutcome = async (outcome: string) => {
        if (!activeLead) return;
        setProcessingId(activeLead.lead.id);

        // Map UI outcome to Enum
        let enumOutcome = "ENGAGED"; // default fallback
        if (outcome === "booked") enumOutcome = "MEETING_CONFIRMED";
        if (outcome === "vm") enumOutcome = "COORDINATING"; // Keep open
        if (outcome === "closed") enumOutcome = "CLOSED";
        if (outcome === "callback") enumOutcome = "COORDINATING";

        try {
            const res = await fetch((process.env['NEXT_PUBLIC_API_URL'] || "/api/proxy") + "/caller/queue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "complete",
                    leadId: activeLead.lead.id,
                    outcome: enumOutcome,
                    notes
                })
            });
            if (res.ok) {
                setNotes("");
                setActiveLead(null);
                await fetchQueue();
            }
        } finally {
            setProcessingId(null);
        }
    };

    if (loading && !assigned.length && !pool.length) return <div className="p-8">Loading Queue...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Sidebar: Queue List */}
            <div className="col-span-1 space-y-6">
                <div>
                    <h3 className="text-lg font-bold mb-2">My Active Tasks ({assigned.length})</h3>
                    <div className="space-y-2">
                        {assigned.map(item => (
                            <Card
                                key={item.id}
                                className={`p-3 cursor-pointer hover:bg-muted ${activeLead?.id === item.id ? 'border-primary' : ''}`}
                                onClick={() => setActiveLead(item)}
                            >
                                <div className="font-semibold">{item.lead.fullName || item.lead.email}</div>
                                <div className="text-xs text-muted-foreground">{item.lead.company}</div>
                                <Badge variant="info" className="mt-1">{item.status}</Badge>
                            </Card>
                        ))}
                        {assigned.length === 0 && <div className="text-sm text-muted-foreground">No active tasks.</div>}
                    </div>
                </div>

                <div>
                    <h3 className="text-lg font-bold mb-2">Unassigned Pool</h3>
                    <div className="space-y-2">
                        {pool.map(item => (
                            <Card key={item.id} className="p-3 flex justify-between items-center">
                                <div>
                                    <div className="font-medium">{item.lead.fullName || "Unknown"}</div>
                                    <div className="text-xs text-muted-foreground">{item.lead.company}</div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    disabled={processingId === item.lead.id}
                                    onClick={() => handleClaim(item.lead.id)}
                                >
                                    Claim
                                </Button>
                            </Card>
                        ))}
                        {pool.length === 0 && <div className="text-sm text-muted-foreground">Pool is empty.</div>}
                    </div>
                </div>
            </div>

            {/* Main Area: Focus View */}
            <div className="col-span-2">
                {activeLead ? (
                    <Card className="p-6 h-full flex flex-col space-y-6">
                        {/* Header Details */}
                        <div className="flex justify-between items-start pb-4 border-b border-border">
                            <div>
                                <h1 className="text-3xl font-bold flex items-center gap-2">
                                    <User className="w-6 h-6 text-brand-500" />
                                    {activeLead.lead.fullName || "Unnamed Lead"}
                                </h1>
                                <p className="text-xl text-muted-foreground mt-0.5">{activeLead.lead.company || "Independent"}</p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge variant="outline" className="flex items-center gap-1">
                                        <Smartphone className="w-3 h-3 text-brand-500" />
                                        {activeLead.lead.phone || "No Phone"}
                                    </Badge>
                                    <Badge variant="outline" className="flex items-center gap-1">
                                        <Mail className="w-3 h-3 text-brand-500" />
                                        {activeLead.lead.email}
                                    </Badge>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Deal Stage</div>
                                <div className="text-lg font-bold text-brand-600 dark:text-brand-400">
                                    {activeLead.lead.pipelineState || "COORDINATING"}
                                </div>
                            </div>
                        </div>

                        {/* Intent Breakdown & Predictive Intelligence */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Intent Score Progress Card */}
                            <div className="p-4 rounded-xl bg-brand-500/5 border border-brand-500/10 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                        <Flame className="w-4 h-4 text-orange-500" />
                                        Intent Strength
                                    </span>
                                    <span className="font-mono font-bold text-brand-600 dark:text-brand-400 text-sm">
                                        {Math.round((activeLead.lead.intentScore || 0) * 100)}%
                                    </span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2">
                                    <div
                                        className={`h-2 rounded-full transition-all ${
                                            (activeLead.lead.intentScore || 0) >= 0.7 ? 'bg-red-500' :
                                            (activeLead.lead.intentScore || 0) >= 0.4 ? 'bg-amber-500' : 'bg-blue-500'
                                        }`}
                                        style={{ width: `${Math.round((activeLead.lead.intentScore || 0) * 100)}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-[11px] text-muted-foreground">
                                    <span>Calculated Tier</span>
                                    <span className="font-semibold text-foreground">
                                        {(activeLead.lead.intentScore || 0) >= 0.7 ? 'HOT 🔥' :
                                         (activeLead.lead.intentScore || 0) >= 0.4 ? 'WARM ⚡' : 'COLD ❄️'}
                                    </span>
                                </div>
                            </div>

                            {/* Predictive AI Analytics */}
                            <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    <BrainCircuit className="w-4 h-4 text-purple-400" />
                                    Predictive AI Context
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-muted p-2 rounded-lg flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Best Hour</p>
                                            <p className="font-semibold text-foreground">
                                                {activeLead.lead.optimalSendHour !== undefined && activeLead.lead.optimalSendHour !== null
                                                    ? `${activeLead.lead.optimalSendHour > 12 ? activeLead.lead.optimalSendHour - 12 : activeLead.lead.optimalSendHour}:00 ${activeLead.lead.optimalSendHour >= 12 ? 'PM' : 'AM'}`
                                                    : '10:00 AM'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <div className="bg-muted p-2 rounded-lg flex items-center gap-1">
                                        <TrendingUp className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                                        <div>
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Churn Risk</p>
                                            <p className={`font-semibold ${
                                                (activeLead.lead.churnRisk || 0) > 0.5 ? 'text-red-400' : 'text-emerald-400'
                                            }`}>
                                                {activeLead.lead.churnRisk !== undefined && activeLead.lead.churnRisk !== null
                                                    ? `${Math.round(activeLead.lead.churnRisk * 100)}%`
                                                    : 'Low (12%)'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Dialogue Thread */}
                        <div className="flex-1 flex flex-col bg-muted/20 p-4 rounded-xl border border-border min-h-[260px] max-h-[360px]">
                            <h4 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
                                <Activity className="w-4 h-4 text-brand-500" />
                                Live Dialogue Context
                            </h4>
                            <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-sm">
                                {activeLead.lead.threads?.[0]?.entries?.length > 0 ? (
                                    activeLead.lead.threads[0].entries.map((entry: any, entryIdx: number) => (
                                        <div
                                            key={entry.id || entryIdx}
                                            className={`p-3 rounded-2xl max-w-[85%] ${
                                                entry.role === 'assistant'
                                                    ? 'bg-brand-500/10 border border-brand-500/20 mr-auto text-left rounded-bl-none'
                                                    : entry.role === 'user'
                                                    ? 'bg-muted ml-auto text-right rounded-br-none'
                                                    : 'bg-yellow-500/10 border border-yellow-500/20 mx-auto text-center text-xs text-yellow-500 rounded-lg'
                                            }`}
                                        >
                                            <p className="font-bold text-[10px] uppercase tracking-wider opacity-60 mb-1">
                                                {entry.role === 'assistant' ? '🤖 AI Assistant' : entry.role === 'user' ? activeLead.lead.fullName : '⚙️ System'}
                                            </p>
                                            <p className="whitespace-pre-wrap leading-relaxed">{entry.content}</p>
                                        </div>
                                    ))
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground italic py-12 space-y-1">
                                        <Sparkles className="w-8 h-8 opacity-20 mb-2" />
                                        <p>No recent messages in thread.</p>
                                        <p className="text-xs opacity-60">Ready for initial contact call</p>
                                    </div>
                                )}
                            </div>
                            {activeLead.lead.hotAt && (
                                <p className="text-[10px] text-muted-foreground mt-3 italic text-right">
                                    Lead promoted to HOT on {new Date(activeLead.lead.hotAt).toLocaleDateString()} at {new Date(activeLead.lead.hotAt).toLocaleTimeString()}
                                </p>
                            )}
                        </div>

                        {/* Interactive Outcomes Panel */}
                        <div className="space-y-4 pt-2">
                            <Textarea
                                placeholder="Add call notes, summary of agreement, or details on voicemail left..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="min-h-[90px] rounded-xl border-border bg-background focus-visible:ring-brand-500"
                            />

                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                                <Button onClick={() => handleOutcome("booked")} className="bg-green-600 hover:bg-green-700 text-white rounded-xl py-5 font-bold shadow-lg shadow-green-950/20 transition-all hover:scale-[1.01]">
                                    Meeting Booked
                                </Button>
                                <Button onClick={() => handleOutcome("callback")} variant="outline" className="rounded-xl py-5 font-bold hover:bg-muted/80">
                                    Callback Needed
                                </Button>
                                <Button onClick={() => handleOutcome("vm")} variant="outline" className="rounded-xl py-5 font-bold hover:bg-muted/80">
                                    Left Voicemail
                                </Button>
                                <Button onClick={() => handleOutcome("closed")} variant="destructive" className="rounded-xl py-5 font-bold shadow-lg shadow-red-950/20 transition-all hover:scale-[1.01]">
                                    Not Interested
                                </Button>
                            </div>
                        </div>
                    </Card>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-16 text-muted-foreground bg-muted/5 min-h-[500px]">
                        <Sparkles className="w-16 h-16 opacity-10 mb-4 animate-pulse" />
                        <p className="font-semibold">Select a lead to start calling</p>
                        <p className="text-xs opacity-60 mt-1">HOT leads appear here when their intent score reaches 70%</p>
                    </div>
                )}
            </div>
        </div>
    );
}
