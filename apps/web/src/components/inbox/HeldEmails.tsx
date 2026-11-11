"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";

export interface HeldMissingToken {
    token: string;
    reason: "empty" | "unknown";
    suggestedFallback: string | null;
    advice: string;
}

export interface HeldEmail {
    runId: string;
    leadId: string;
    leadName: string | null;
    email: string | null;
    company: string | null;
    campaignName: string | null;
    sequenceName: string | null;
    subject: string | null;
    heldAt: string | null;
    missing: HeldMissingToken[];
    canApprove: boolean;
}

// Emails the system did not send because a merge field such as {{firstName}} is empty for the contact (or
// mistyped in the step). Nothing goes out until the sender fixes it or approves the suggested fallback.
export function HeldEmails({
    items,
    total,
    onApprove,
    onRetry,
}: {
    items: HeldEmail[];
    // All held emails; larger than items.length when the list is cut off.
    total?: number | undefined;
    onApprove: (runId: string) => Promise<void>;
    onRetry: (runId: string) => Promise<void>;
}) {
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<{ runId: string; message: string } | null>(null);

    if (items.length === 0) {
        return <GlassCard className="p-8 text-sm text-muted-foreground">No emails are waiting. Every merge field was filled.</GlassCard>;
    }

    async function run(runId: string, action: (id: string) => Promise<void>) {
        setBusy(runId);
        setError(null);
        try {
            await action(runId);
        } catch (e) {
            setError({ runId, message: e instanceof Error ? e.message : "Could not approve" });
        } finally {
            setBusy(null);
        }
    }

    return (
        <div className="space-y-3">
        {total !== undefined && total > items.length && (
            <p className="text-sm text-muted-foreground">
                Showing the newest {items.length} of {total} held emails. The rest appear here as you approve or fix these.
            </p>
        )}
        <ul className="space-y-3" aria-label="Held emails">
            {items.map((item) => (
                <li key={item.runId}>
                    <GlassCard className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-foreground">{item.leadName || item.email || "Unknown contact"}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                    {[item.email, item.company, item.campaignName, item.sequenceName].filter(Boolean).join(" · ")}
                                </p>
                                {item.subject && <p className="mt-1 truncate text-xs text-muted-foreground">Subject: {item.subject}</p>}
                            </div>
                            {item.heldAt && (
                                <span className="shrink-0 text-[11px] text-muted-foreground">
                                    held {formatDistanceToNow(new Date(item.heldAt), { addSuffix: true })}
                                </span>
                            )}
                        </div>

                        <ul className="space-y-2">
                            {item.missing.map((m) => (
                                <li key={m.token} className="flex gap-2 text-sm">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                                    <span>
                                        <code className="rounded bg-muted px-1">{`{{${m.token}}}`}</code>{" "}
                                        <span className="text-muted-foreground">{m.reason === "unknown" ? "is not a known field." : "is empty for this contact."}</span>{" "}
                                        <span>{m.advice}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="sm" disabled={!item.canApprove || busy === item.runId} onClick={() => run(item.runId, onApprove)}>
                                {busy === item.runId ? "Approving..." : "Approve and send with the suggested fallback"}
                            </Button>
                            <Button size="sm" variant="outline" disabled={busy === item.runId} onClick={() => run(item.runId, onRetry)}>
                                I fixed it, check again
                            </Button>
                            {!item.canApprove && (
                                <span className="text-xs text-muted-foreground">
                                    Cannot send as is: fix the contact or the step, then check again.
                                </span>
                            )}
                            {error?.runId === item.runId && <span className="text-xs text-red-500">{error.message}</span>}
                        </div>
                    </GlassCard>
                </li>
            ))}
        </ul>
        </div>
    );
}
