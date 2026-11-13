"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Clock, Lock, ShieldAlert, XCircle } from "lucide-react";
import { getBrowserApiBase } from "@/lib/api/browserBase";

type StepState = "done" | "active" | "waiting" | "blocked" | "todo";

interface Step {
    key: string;
    label: string;
    state: StepState;
    gated: boolean;
    detail: string | null;
}

interface Approval {
    requestId: string;
    status: string;
    actionType: string;
    reason: string | null;
    expiresAt: string | null;
}

const DOT: Record<StepState, string> = {
    done: "bg-emerald-500 text-white border-emerald-500",
    active: "bg-primary/20 text-primary border-primary",
    waiting: "bg-amber-500/20 text-amber-500 border-amber-500",
    blocked: "bg-red-500/20 text-red-500 border-red-500",
    todo: "bg-muted text-muted-foreground border-border",
};

function StepIcon({ step, index }: { step: Step; index: number }) {
    if (step.state === "done") return <Check className="w-3.5 h-3.5" />;
    if (step.state === "waiting") return <Clock className="w-3.5 h-3.5" />;
    if (step.state === "blocked") return <XCircle className="w-3.5 h-3.5" />;
    if (step.gated && step.state === "todo") return <Lock className="w-3 h-3" />;
    return <span className="text-[10px] font-semibold">{index + 1}</span>;
}

// Read-only: shows where the lead is in the governed flow. Approving or rejecting happens on the Approvals page.
export function LeadWorkflowRail({ leadId }: { leadId: string }) {
    const [data, setData] = useState<{ steps: Step[]; approval: Approval | null } | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${getBrowserApiBase()}/leads/${leadId}/workflow`, { cache: "no-store" });
                if (res.ok && !cancelled) setData((await res.json()).data);
            } catch {
                /* leave the rail hidden */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [leadId]);

    if (!data) return null;
    const { steps, approval } = data;

    return (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Governed workflow">
            <ol className="flex flex-wrap gap-x-4 gap-y-3">
                {steps.map((step, i) => (
                    <li key={step.key} className="flex items-center gap-2 min-w-[8.5rem]" title={step.detail ?? undefined}>
                        <span className={`flex items-center justify-center w-6 h-6 rounded-full border ${DOT[step.state]}`}>
                            <StepIcon step={step} index={i} />
                        </span>
                        <span className="leading-tight">
                            <span className="block text-xs font-medium text-foreground">{step.label}</span>
                            <span className="block text-[10px] text-muted-foreground">
                                {step.detail ?? (step.gated ? "Needs manager sign-off" : "—")}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>

            {approval?.status === "PENDING" && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
                    <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                        <p className="font-medium text-foreground">Action requires review</p>
                        <p className="text-muted-foreground">
                            Proposed: {approval.actionType.replaceAll("_", " ").toLowerCase()}
                            {approval.reason ? ` - ${approval.reason}` : ""}
                        </p>
                        <p className="text-muted-foreground font-mono">Request {approval.requestId}</p>
                        {approval.expiresAt && (
                            <p className="text-muted-foreground">Expires {new Date(approval.expiresAt).toLocaleString()}</p>
                        )}
                        <Link href="/approvals" className="inline-block text-primary hover:underline pt-1">
                            Review in Approvals
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
