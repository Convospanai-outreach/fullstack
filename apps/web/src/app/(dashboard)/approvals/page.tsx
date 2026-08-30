"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { Check, AlertCircle, Clock, Lightbulb, X } from "lucide-react";

interface ApprovalRequest {
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    status: string;
    tier: string;
    reason: string;
    payload?: {
        subject?: string;
        body?: string;
        recipient?: string;
        emailId?: string;
        leadId?: string;
        campaignId?: string;
    };
    requester: {
        name: string;
        email: string;
        image: string;
    };
    createdAt: string;
}

interface OverseerNudge {
    id: string;
    stage: string;
    stallDays: number;
    nudgeType: string;
    suggestion: string;
    createdAt: string;
}

function BreakerPill({ state }: { state: string | null }) {
    if (!state || state === "CLOSED") {
        return (
            <span className="px-3 py-1 rounded-full bg-success/10 text-success text-xs border border-success/20 font-medium uppercase tracking-wide">
                Queue Healthy
            </span>
        );
    }
    const label = state === "HALF_OPEN" ? "Recovering" : "Backed Up";
    return (
        <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium uppercase tracking-wide" title="Queued-approval timeouts extended to 72h and new stall nudges paused until this recovers.">
            {label}
        </span>
    );
}

function TierBadge({ tier }: { tier: string }) {
    if (tier === "HARD_BLOCK") {
        return (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium uppercase tracking-wide">
                Hard Block
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs border border-warning/20 font-medium uppercase tracking-wide">
            Queued · 24h
        </span>
    );
}

export default function ApprovalsPage() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [nudges, setNudges] = useState<OverseerNudge[]>([]);
    const [breakerState, setBreakerState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
        fetchNudges();
        fetchBreakerState();
    }, []);

    const fetchBreakerState = async () => {
        try {
            const res = await fetch("/api/overseer/breaker");
            const data = await res.json();
            if (data.state) {
                setBreakerState(data.state);
            }
        } catch (err) {
            console.error("Failed to load breaker state", err);
        }
    };

    const fetchRequests = async () => {
        try {
            // Assuming context provides teamId or API infers it from session
            // For MVP we just hit the endpoint, assuming it might default or we need to pass a teamId query param
            // Ideally we get teamId from a context provider
            const res = await fetch("/api/approvals");
            const data = await res.json();
            if (data.requests) {
                setRequests(data.requests);
            }
        } catch (err) {
            console.error("Failed to load approvals", err);
            toast.error("Failed to load requests");
        } finally {
            setLoading(false);
        }
    };

    const fetchNudges = async () => {
        try {
            const res = await fetch("/api/overseer/nudges");
            const data = await res.json();
            if (data.nudges) {
                setNudges(data.nudges);
            }
        } catch (err) {
            console.error("Failed to load overseer nudges", err);
        }
    };

    const handleNudgeAction = async (id: string, action: "ACTED" | "DISMISSED") => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/overseer/nudges/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action })
            });
            if (!res.ok) throw new Error("Action failed");
            setNudges(current => current.filter(n => n.id !== id));
        } catch (err) {
            toast.error("Failed to update nudge");
        } finally {
            setProcessing(null);
        }
    };

    const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
        setProcessing(id);
        try {
            const res = await fetch(`/api/approvals/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason: action === "REJECT" ? "Rejected by admin" : undefined })
            });

            if (!res.ok) throw new Error("Action failed");

            toast.success(action === "APPROVE" ? "Request Approved" : "Request Rejected");

            // Remove from list or refresh
            setRequests(current => current.filter(r => r.id !== id));
        } catch (err) {
            toast.error("Failed to process request");
        } finally {
            setProcessing(null);
        }
    };

    if (loading) return <div className="p-8 text-foreground">Loading approvals...</div>;

    return (
        <div className="space-y-8 max-w-5xl">
            <div className="flex items-start justify-between gap-4">
                <SectionHeader
                    title="Approval Inbox"
                    subtitle="Review and authorize sensitive actions requested by your team."
                />
                <BreakerPill state={breakerState} />
            </div>

            {requests.length === 0 ? (
                <GlassCard className="p-12 text-center flex flex-col items-center justify-center opacity-70">
                    <Check className="w-12 h-12 text-success mb-4" />
                    <h3 className="text-xl font-bold text-foreground">All Caught Up!</h3>
                    <p className="text-muted-foreground">No pending approval requests found.</p>
                </GlassCard>
            ) : (
                <div className="grid gap-4">
                    {requests.map((req) => (
                        <GlassCard key={req.id} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between group hover:border-primary/30 transition-all">
                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold border border-primary/30">
                                    {req.requester?.name?.charAt(0) || "U"}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-foreground text-lg">{formatAction(req.actionType)}</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-xs border border-warning/20 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Pending
                                        </span>
                                        <TierBadge tier={req.tier} />
                                    </div>
                                    <p className="text-muted-foreground text-sm mb-2">
                                        Requested by <span className="text-foreground">{req.requester?.name || "System"}</span> on {new Date(req.createdAt).toLocaleDateString()}
                                    </p>
                                    {req.payload?.subject && (
                                        <div className="bg-muted p-3.5 rounded-lg border border-border text-sm space-y-1.5 mt-2">
                                            <div className="text-xs font-bold uppercase tracking-wider text-primary">
                                                Subject: <span className="text-foreground font-semibold normal-case">{req.payload.subject}</span>
                                            </div>
                                            {req.payload.recipient && (
                                                <div className="text-xs text-muted-foreground">
                                                    To: <span className="text-foreground">{req.payload.recipient}</span>
                                                </div>
                                            )}
                                            {req.payload.body && (
                                                <div className="text-foreground text-xs leading-relaxed line-clamp-3 bg-background p-2.5 rounded border border-border font-mono whitespace-pre-wrap">
                                                    {req.payload.body}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {req.reason && !req.payload?.subject && (
                                        <div className="bg-muted p-3 rounded-lg border border-border text-sm text-foreground flex gap-2 mt-2">
                                            <AlertCircle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                            "{req.reason}"
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    disabled={!!processing}
                                    onClick={() => handleAction(req.id, "REJECT")}
                                    className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 text-sm font-medium"
                                >
                                    Reject
                                </button>
                                <button
                                    disabled={!!processing}
                                    onClick={() => handleAction(req.id, "APPROVE")}
                                    className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-success text-white hover:bg-success/90 transition-all disabled:opacity-50 disabled:shadow-none text-sm font-medium flex items-center justify-center gap-2"
                                >
                                    {processing === req.id ? "Processing..." : (
                                        <>
                                            <Check className="w-4 h-4" /> Approve
                                        </>
                                    )}
                                </button>
                            </div>
                        </GlassCard>
                    ))}
                </div>
            )}

            {nudges.length > 0 && (
                <div className="space-y-4">
                    <SectionHeader
                        title="Stalled Funnel Nudges"
                        subtitle="Overseer-flagged sequence enrollments that have gone quiet — advisory only, nothing here executes automatically."
                    />
                    <div className="grid gap-4">
                        {nudges.map((nudge) => (
                            <GlassCard key={nudge.id} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                                <div className="flex gap-4 items-start">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0 border border-primary/30">
                                        <Lightbulb className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-foreground text-lg">{formatAction(nudge.nudgeType)}</h4>
                                            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs border border-border">
                                                {nudge.stage} · stalled {nudge.stallDays.toFixed(1)}d
                                            </span>
                                        </div>
                                        <p className="text-muted-foreground text-sm">{nudge.suggestion}</p>
                                    </div>
                                </div>
                                <div className="flex gap-3 w-full md:w-auto">
                                    <button
                                        disabled={!!processing}
                                        onClick={() => handleNudgeAction(nudge.id, "DISMISSED")}
                                        className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <X className="w-4 h-4" /> Dismiss
                                    </button>
                                    <button
                                        disabled={!!processing}
                                        onClick={() => handleNudgeAction(nudge.id, "ACTED")}
                                        className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50 text-sm font-medium flex items-center justify-center gap-2"
                                    >
                                        <Check className="w-4 h-4" /> Mark Acted
                                    </button>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

function formatAction(action: string) {
    return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
