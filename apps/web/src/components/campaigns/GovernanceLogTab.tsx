"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface GovernanceRow {
    id: string;
    at: string;
    actor: string;
    action: string;
    argumentNames: string[];
    requestId: string | null;
    outcome: string;
}

type State = { status: "loading" } | { status: "error" } | { status: "ready"; rows: GovernanceRow[]; capped: boolean };

// Read-only trail of approvals and campaign changes: who asked, who decided, and what happened.
export default function GovernanceLogTab({ campaignId }: { campaignId: string }) {
    const [state, setState] = useState<State>({ status: "loading" });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${getBrowserApiBase()}/campaigns/${campaignId}/governance`, { cache: "no-store" });
                if (!res.ok) throw new Error("governance log unavailable");
                const data = (await res.json()).data as { rows: GovernanceRow[]; capped?: boolean };
                if (!cancelled) setState({ status: "ready", rows: data.rows, capped: Boolean(data.capped) });
            } catch {
                if (!cancelled) setState({ status: "error" });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-4">
            <h2 className="text-xl font-semibold text-foreground">Governance Log</h2>

            <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                    This log records approvals and outcomes, not message content or lead details. It does show the names or emails
                    of the people who asked and decided. It covers approvals for this campaign and its leads, and changes made to the campaign.
                </span>
            </p>

            {state.status === "loading" && <p className="text-sm text-muted-foreground">Loading…</p>}
            {state.status === "error" && (
                <p className="text-sm text-destructive">Couldn&apos;t load the governance log. This is a temporary problem, not an empty log.</p>
            )}
            {state.status === "ready" && state.capped && (
                <p className="text-xs text-amber-600">This campaign is large, so the log shows the newest entries only. Older approvals may be missing.</p>
            )}
            {state.status === "ready" && state.rows.length === 0 && (
                <p className="text-sm text-muted-foreground">No approvals or campaign changes have been recorded for this campaign yet.</p>
            )}
            {state.status === "ready" && state.rows.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="text-muted-foreground border-b border-border">
                            <tr>
                                <th className="py-2 pr-4 font-medium">Timestamp</th>
                                <th className="py-2 pr-4 font-medium">Actor</th>
                                <th className="py-2 pr-4 font-medium">Action</th>
                                <th className="py-2 pr-4 font-medium">Arguments reviewed</th>
                                <th className="py-2 pr-4 font-medium">Request ID</th>
                                <th className="py-2 font-medium">Outcome</th>
                            </tr>
                        </thead>
                        <tbody>
                            {state.rows.map((row) => (
                                <tr key={row.id} className="border-b border-border/60 align-top">
                                    <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{new Date(row.at).toLocaleString()}</td>
                                    <td className="py-2 pr-4 text-foreground">{row.actor}</td>
                                    <td className="py-2 pr-4 text-foreground">{row.action}</td>
                                    <td className="py-2 pr-4 text-muted-foreground" title="Field names only; values are not kept in this log">
                                        {row.argumentNames.length > 0 ? row.argumentNames.join(", ") : "—"}
                                    </td>
                                    <td className="py-2 pr-4 font-mono text-muted-foreground">{row.requestId ?? "—"}</td>
                                    <td className="py-2 text-foreground">{row.outcome}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
