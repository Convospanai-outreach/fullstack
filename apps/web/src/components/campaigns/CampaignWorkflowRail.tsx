"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

interface StepSummary {
    key: string;
    label: string;
    gated: boolean;
    rule: string;
    done: number;
    current: number;
    blocked: number;
}

interface Summary {
    leadCount: number;
    capped: boolean;
    steps: StepSummary[];
}

// Read-only: how many of this campaign's leads sit at each step of the governed flow.
export function CampaignWorkflowRail({ campaignId }: { campaignId: string }) {
    const [summary, setSummary] = useState<Summary | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${getBrowserApiBase()}/campaigns/${campaignId}/workflow`, { cache: "no-store" });
                if (res.ok && !cancelled) setSummary((await res.json()).data);
            } catch {
                /* leave the rail hidden */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    if (!summary || summary.leadCount === 0) return null;

    return (
        <div className="rounded-lg border bg-card p-4 space-y-3" aria-label="Governed workflow for this campaign">
            <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-semibold text-foreground">Where leads are in the workflow</h2>
                <span className="text-xs text-muted-foreground">
                    {summary.capped ? `Newest ${summary.leadCount.toLocaleString()} leads` : `${summary.leadCount.toLocaleString()} leads`}
                </span>
            </div>
            <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {summary.steps.map((step, i) => (
                    <li key={step.key} className="rounded-md border border-border p-2.5" title={step.rule}>
                        <p className="flex items-center gap-1 text-xs font-medium text-foreground">
                            <span className="text-muted-foreground">{i + 1}.</span>
                            {step.label}
                            {step.gated && <Lock className="w-3 h-3 text-muted-foreground" aria-label="Needs manager sign-off" />}
                        </p>
                        <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
                            <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${Math.round((step.done / summary.leadCount) * 100)}%` }}
                            />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted-foreground">
                            {step.done} done · {step.current} here
                            {step.blocked > 0 && <span className="text-red-500"> · {step.blocked} blocked</span>}
                        </p>
                    </li>
                ))}
            </ol>
        </div>
    );
}
