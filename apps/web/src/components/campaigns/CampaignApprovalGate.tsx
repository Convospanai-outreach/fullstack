"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, ShieldAlert } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import { formatTimeLeft, getExpiryState } from "@/lib/approvalExpiry";

interface PendingRequest {
    requestId: string;
    actionType: string;
    tier: string;
    reason: string | null;
    requestedBy: string | null;
    createdAt: string;
    expiresAt: string | null;
    draft: { subject: string | null; body: string | null };
}

const readable = (action: string) => action.replaceAll("_", " ").toLowerCase();

function Expiry({ expiresAt }: { expiresAt: string | null }) {
    const state = getExpiryState(expiresAt);
    if (state === "none" || !expiresAt) return null;
    return (
        <span className={`inline-flex items-center gap-1 ${state === "later" ? "text-muted-foreground" : "text-destructive"}`}>
            <Clock className="w-3 h-3" />
            {state === "expired" ? "Expired" : `Expires in ${formatTimeLeft(expiresAt)}`}
        </span>
    );
}

// The approval gate for one campaign: what is waiting for a manager, with the request id and expiry.
// Approve and Reject call the existing approvals endpoint, which enforces who may decide and does the sending.
export function CampaignApprovalGate({ campaignId }: { campaignId: string }) {
    const [data, setData] = useState<{ canDecide: boolean; requests: PendingRequest[] } | null>(null);
    const [busy, setBusy] = useState<string | null>(null);

    const load = useCallback(async (isStale: () => boolean = () => false) => {
        try {
            const res = await fetch(`${getBrowserApiBase()}/campaigns/${campaignId}/approvals`, { cache: "no-store" });
            if (res.ok) {
                const next = (await res.json()).data;
                if (!isStale()) setData(next);
            }
        } catch {
            /* leave the gate hidden */
        }
    }, [campaignId]);

    useEffect(() => {
        // A late response for a previous campaign must not replace this campaign's requests.
        let stale = false;
        setData(null);
        void load(() => stale);
        return () => {
            stale = true;
        };
    }, [load]);

    async function decide(request: PendingRequest, action: "APPROVE" | "REJECT") {
        if (action === "APPROVE" && !window.confirm(`Approve "${readable(request.actionType)}"? It will go ahead as written.`)) return;
        setBusy(request.requestId);
        try {
            const res = await fetch(`/api/approvals/${request.requestId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...(action === "REJECT" ? { reason: "Rejected from the campaign page" } : {}) }),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "The decision was not saved");
            }
            toast.success(action === "APPROVE" ? "Request approved" : "Request rejected");
            await load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "The decision was not saved");
        } finally {
            setBusy(null);
        }
    }

    if (!data || data.requests.length === 0) return null;

    return (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-3" aria-label="Actions waiting for review">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ShieldAlert className="w-4 h-4 text-amber-500" />
                {data.requests.length === 1 ? "1 action requires review" : `${data.requests.length} actions require review`}
            </h2>
            <ul className="space-y-3">
                {data.requests.map((request) => (
                    <li key={request.requestId} className="rounded-md border border-border bg-card p-3 text-xs space-y-2">
                        <p className="text-foreground">
                            <span className="font-medium">Proposed: {readable(request.actionType)}</span>
                            {request.requestedBy && <span className="text-muted-foreground"> · asked by {request.requestedBy}</span>}
                        </p>
                        {(request.draft.subject || request.draft.body) && (
                            <div className="rounded border border-border bg-muted/40 p-2 space-y-1">
                                {request.draft.subject && <p className="font-medium text-foreground">{request.draft.subject}</p>}
                                {request.draft.body && <p className="text-muted-foreground line-clamp-3 whitespace-pre-line">{request.draft.body}</p>}
                            </div>
                        )}
                        {!request.draft.subject && !request.draft.body && request.reason && <p className="text-muted-foreground">{request.reason}</p>}
                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                            <span className="font-mono">Request {request.requestId}</span>
                            <Expiry expiresAt={request.expiresAt} />
                        </p>
                        {data.canDecide ? (
                            <div className="flex flex-wrap gap-2 pt-1">
                                <button
                                    type="button"
                                    disabled={busy === request.requestId || getExpiryState(request.expiresAt) === "expired"}
                                    onClick={() => void decide(request, "APPROVE")}
                                    className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground disabled:opacity-50"
                                >
                                    Approve
                                </button>
                                <Link href="/approvals" className="rounded-md border border-border px-3 py-1.5 font-medium text-foreground hover:bg-accent">
                                    Edit draft
                                </Link>
                                <button
                                    type="button"
                                    disabled={busy === request.requestId}
                                    onClick={() => void decide(request, "REJECT")}
                                    className="rounded-md border border-destructive/40 px-3 py-1.5 font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                >
                                    Reject
                                </button>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">Waiting for a manager. You do not have permission to decide this.</p>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
}
