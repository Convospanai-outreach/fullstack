"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { Check, AlertCircle, Clock } from "lucide-react";
import { getExpiryState, formatTimeLeft } from "@/lib/approvalExpiry";
import { StalledNudgeList } from "@/components/overseer/StalledNudgeList";

interface NeedsAttentionItem {
    id: string;
    channel: string | null;
    leadName: string | null;
    leadEmail: string | null;
    reason: string;
    createdAt: string;
}

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
        mediaUrls?: string[]; // CONTENT_POST_PUBLISH: the post's images
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
    autoDenyAt?: string | null;
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
            Queued
        </span>
    );
}

// Shows the real auto-deny deadline for a QUEUED request instead of a hardcoded
// "24h": nothing for requests with no expiry (AUTO/HARD_BLOCK, or legacy rows
// with a null autoDenyAt), a muted countdown otherwise, and a red "Expiring
// soon" once inside the warning window - the same point the reviewer gets a
// warning notification. Classification logic lives in @/lib/approvalExpiry.
function ExpiryBadge({ autoDenyAt }: { autoDenyAt?: string | null }) {
    const state = getExpiryState(autoDenyAt);
    if (state === "none" || !autoDenyAt) return null;

    if (state === "expired") {
        return (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> Expired
            </span>
        );
    }
    if (state === "soon") {
        return (
            <span className="px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs border border-destructive/20 font-medium uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3" /> Expiring soon · {formatTimeLeft(autoDenyAt)}
            </span>
        );
    }
    return (
        <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs border border-border font-medium uppercase tracking-wide flex items-center gap-1">
            <Clock className="w-3 h-3" /> Auto-denies in {formatTimeLeft(autoDenyAt)}
        </span>
    );
}

export default function ApprovalsPage() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [needsAttention, setNeedsAttention] = useState<NeedsAttentionItem[]>([]);
    const [breakerState, setBreakerState] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
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
            setNeedsAttention(data.needsAttention ?? []);
        } catch (err) {
            console.error("Failed to load approvals", err);
            toast.error("Failed to load requests");
        } finally {
            setLoading(false);
        }
    };

    const [edits, setEdits] = useState<Record<string, { subject?: string | undefined; body: string }>>({});

    const handleAction = async (id: string, action: "APPROVE" | "REJECT") => {
        setProcessing(id);
        try {
            const edit = action === "APPROVE" ? edits[id] : undefined;
            const res = await fetch(`/api/approvals/${id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, reason: action === "REJECT" ? "Rejected by admin" : undefined, ...edit })
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data?.error || "Action failed");
            }

            toast.success(action === "APPROVE" ? "Request Approved" : "Request Rejected");

            // Remove from list or refresh
            setRequests(current => current.filter(r => r.id !== id));
        } catch (err) {
            toast.error(err instanceof Error && err.message !== "Action failed" ? err.message : "Failed to process request");
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
                                        <ExpiryBadge autoDenyAt={req.autoDenyAt ?? null} />
                                    </div>
                                    <p className="text-muted-foreground text-sm mb-2">
                                        Requested by <span className="text-foreground">{req.requester?.name || "System"}</span> on {new Date(req.createdAt).toLocaleDateString()}
                                    </p>
                                    {req.actionType === "MESSAGE_SEND" && req.payload?.body && (
                                        <div className="bg-muted p-3.5 rounded-lg border border-border text-sm space-y-2 mt-2">
                                            {edits[req.id] ? (
                                                <>
                                                    {req.payload.subject !== undefined && (
                                                        <input
                                                            aria-label="Subject"
                                                            value={edits[req.id].subject ?? ""}
                                                            onChange={(e) => setEdits((cur) => ({ ...cur, [req.id]: { ...cur[req.id], subject: e.target.value } }))}
                                                            className="w-full bg-background border border-border rounded px-2.5 py-1.5 text-xs text-foreground"
                                                        />
                                                    )}
                                                    <textarea
                                                        aria-label="Message"
                                                        rows={8}
                                                        value={edits[req.id].body}
                                                        onChange={(e) => setEdits((cur) => ({ ...cur, [req.id]: { ...cur[req.id], body: e.target.value } }))}
                                                        className="w-full bg-background border border-border rounded px-2.5 py-2 text-xs text-foreground font-mono"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setEdits((cur) => { const { [req.id]: _removed, ...rest } = cur; return rest; })}
                                                        className="text-xs text-muted-foreground underline"
                                                    >
                                                        Discard changes
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    {req.payload.subject && (
                                                        <div className="text-xs font-bold uppercase tracking-wider text-primary">
                                                            Subject: <span className="text-foreground font-semibold normal-case">{req.payload.subject}</span>
                                                        </div>
                                                    )}
                                                    <div className="text-foreground text-xs leading-relaxed bg-background p-2.5 rounded border border-border font-mono whitespace-pre-wrap">
                                                        {req.payload.body}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setEdits((cur) => ({ ...cur, [req.id]: { subject: req.payload?.subject, body: req.payload?.body ?? "" } }))}
                                                        className="text-xs text-primary underline"
                                                    >
                                                        Edit before approving
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                    {req.actionType !== "MESSAGE_SEND" && req.payload?.subject && (
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
                                                <div className={`text-foreground text-xs leading-relaxed ${req.actionType === "CONTENT_POST_PUBLISH" ? "" : "line-clamp-3"} bg-background p-2.5 rounded border border-border font-mono whitespace-pre-wrap`}>
                                                    {req.payload.body}
                                                </div>
                                            )}
                                            {req.payload.mediaUrls && req.payload.mediaUrls.length > 0 && (
                                                <div className="flex flex-wrap gap-2">
                                                    {req.payload.mediaUrls.map((url) => (
                                                        <img key={url} src={url} alt="" className="h-16 w-16 rounded border border-border object-cover" />
                                                    ))}
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

            {needsAttention.length > 0 && (
                <div className="space-y-3">
                    <SectionHeader
                        title="Needs attention"
                        subtitle="These messages were not sent. The AI could not write them or an approval ran out. Nothing went out; re-run the step once the cause is fixed."
                    />
                    <div className="grid gap-3">
                        {needsAttention.map((item) => (
                            <GlassCard key={item.id} className="p-4 flex items-start gap-3 border-destructive/20">
                                <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-1" />
                                <div className="text-sm">
                                    <div className="text-foreground font-medium">
                                        {item.leadName || item.leadEmail || "A lead"}
                                        {item.channel && <span className="ml-2 text-xs uppercase tracking-wide text-muted-foreground">{item.channel}</span>}
                                    </div>
                                    <p className="text-muted-foreground">{item.reason}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{new Date(item.createdAt).toLocaleString()}</p>
                                </div>
                            </GlassCard>
                        ))}
                    </div>
                </div>
            )}

            <StalledNudgeList
                header={
                    <SectionHeader
                        title="Stalled Funnel Nudges"
                        subtitle="Overseer-flagged sequence enrollments that have gone quiet — advisory only, nothing here executes automatically."
                    />
                }
            />
        </div>
    );
}

// Plain-word names for action types whose raw name reads badly.
const ACTION_LABELS: Record<string, string> = { CONTENT_POST_PUBLISH: "Publish post" };

function formatAction(action: string) {
    if (ACTION_LABELS[action]) return ACTION_LABELS[action];
    return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
