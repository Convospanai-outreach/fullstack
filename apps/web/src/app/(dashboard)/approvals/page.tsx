"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { toast } from "sonner";
import { Check, AlertCircle, Clock } from "lucide-react";

interface ApprovalRequest {
    id: string;
    actionType: string;
    entityType: string;
    entityId: string;
    status: string;
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

export default function ApprovalsPage() {
    const [requests, setRequests] = useState<ApprovalRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        fetchRequests();
    }, []);

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

    if (loading) return <div className="p-8 text-white">Loading approvals...</div>;

    return (
        <div className="space-y-8 max-w-5xl">
            <SectionHeader
                title="Approval Inbox"
                subtitle="Review and authorize sensitive actions requested by your team."
            />

            {requests.length === 0 ? (
                <GlassCard className="p-12 text-center flex flex-col items-center justify-center opacity-70">
                    <Check className="w-12 h-12 text-emerald-500 mb-4" />
                    <h3 className="text-xl font-bold text-white">All Caught Up!</h3>
                    <p className="text-gray-400">No pending approval requests found.</p>
                </GlassCard>
            ) : (
                <div className="grid gap-4">
                    {requests.map((req) => (
                        <GlassCard key={req.id} className="p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between group hover:border-blue-500/30 transition-all">
                            <div className="flex gap-4 items-start">
                                <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">
                                    {req.requester?.name?.charAt(0) || "U"}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-bold text-white text-lg">{formatAction(req.actionType)}</h4>
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 text-xs border border-amber-500/20 flex items-center gap-1">
                                            <Clock className="w-3 h-3" /> Pending
                                        </span>
                                    </div>
                                    <p className="text-gray-400 text-sm mb-2">
                                        Requested by <span className="text-white">{req.requester?.name || "System"}</span> on {new Date(req.createdAt).toLocaleDateString()}
                                    </p>
                                    {req.payload?.subject && (
                                        <div className="bg-slate-950/60 p-3.5 rounded-lg border border-white/10 text-sm space-y-1.5 mt-2">
                                            <div className="text-xs font-bold uppercase tracking-wider text-blue-400">
                                                Subject: <span className="text-white font-semibold normal-case">{req.payload.subject}</span>
                                            </div>
                                            {req.payload.recipient && (
                                                <div className="text-xs text-gray-400">
                                                    To: <span className="text-gray-200">{req.payload.recipient}</span>
                                                </div>
                                            )}
                                            {req.payload.body && (
                                                <div className="text-gray-300 text-xs leading-relaxed line-clamp-3 bg-black/40 p-2.5 rounded border border-white/5 font-mono whitespace-pre-wrap">
                                                    {req.payload.body}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {req.reason && !req.payload?.subject && (
                                        <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5 text-sm text-gray-300 flex gap-2 mt-2">
                                            <AlertCircle className="w-4 h-4 text-gray-500 shrink-0 mt-0.5" />
                                            "{req.reason}"
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 w-full md:w-auto">
                                <button
                                    disabled={!!processing}
                                    onClick={() => handleAction(req.id, "REJECT")}
                                    className="flex-1 md:flex-none px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 text-sm font-medium"
                                >
                                    Reject
                                </button>
                                <button
                                    disabled={!!processing}
                                    onClick={() => handleAction(req.id, "APPROVE")}
                                    className="flex-1 md:flex-none px-6 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50 disabled:shadow-none text-sm font-medium flex items-center justify-center gap-2"
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
        </div>
    );
}

function formatAction(action: string) {
    return action.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}
