"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

interface TokenIssue {
    token: string;
    reason: "empty" | "unknown";
    suggestedFallback: string | null;
    advice: string;
    leadsAffected: number;
    sampleLeads: Array<{ id: string; name: string | null; email: string | null }>;
}

interface StepReport {
    stepId: string;
    stepOrder: number;
    subject: string;
    contactsHeld: number;
    issues: TokenIssue[];
}

interface Report {
    leadsChecked: number;
    truncated: boolean;
    steps: StepReport[];
}

const who = (s: { name: string | null; email: string | null }) => s.name || s.email || "Unnamed contact";

// Runs before Enroll: lists the merge fields (such as {{firstName}}) that would be empty or mistyped for the
// campaign's contacts, so they can be fixed now instead of finding the emails held later. Checks the saved sequence.
export default function MergeFieldCheck({ campaignId }: { campaignId: string }) {
    const [report, setReport] = useState<Report | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setReport(null);
        setError(null);
        fetch(getBrowserApiUrl(`/inbox/held-emails/precheck?campaignId=${encodeURIComponent(campaignId)}`), { cache: "no-store" })
            .then(async (res) => {
                const data = await res.json().catch(() => null);
                if (!res.ok) throw new Error(data?.error || "Could not check the merge fields");
                if (!cancelled) setReport(data as Report);
            })
            .catch((e) => {
                if (!cancelled) setError(e instanceof Error ? e.message : "Could not check the merge fields");
            });
        return () => {
            cancelled = true;
        };
    }, [campaignId]);

    if (error) return <div className="border-b border-border bg-card p-4 text-sm text-red-500">{error}</div>;
    if (!report) {
        return (
            <div className="flex items-center gap-2 border-b border-border bg-card p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking merge fields...
            </div>
        );
    }

    const problems = report.steps.filter((s) => s.issues.length > 0);
    return (
        <div className="max-h-80 space-y-3 overflow-auto border-b border-border bg-card p-4" aria-label="Merge field check">
            {report.steps.length === 0 ? (
                <p className="text-sm text-muted-foreground">The saved sequence has no email steps to check. Save the sequence first if you just added one.</p>
            ) : problems.length === 0 ? (
                <p className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                    Every merge field is filled for all {report.leadsChecked.toLocaleString()} contacts.
                </p>
            ) : (
                problems.map((step) => (
                    <div key={step.stepId} className="space-y-2">
                        <p className="text-sm font-semibold">
                            Step {step.stepOrder} ({step.subject}): {step.contactsHeld.toLocaleString()} of {report.leadsChecked.toLocaleString()} contacts would be held
                        </p>
                        <ul className="space-y-2">
                            {step.issues.map((issue) => (
                                <li key={issue.token} className="flex gap-2 text-sm">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
                                    <span>
                                        <code className="rounded bg-muted px-1">{`{{${issue.token}}}`}</code>{" "}
                                        <span className="text-muted-foreground">
                                            {issue.reason === "unknown" ? "is not a known field" : `is empty for ${issue.leadsAffected.toLocaleString()} contact${issue.leadsAffected === 1 ? "" : "s"}`}
                                            {issue.sampleLeads.length > 0 && issue.reason === "empty" ? ` (${issue.sampleLeads.map(who).join(", ")}${issue.leadsAffected > issue.sampleLeads.length ? ", ..." : ""})` : ""}
                                            .
                                        </span>{" "}
                                        {issue.advice}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
            {report.truncated && <p className="text-xs text-muted-foreground">Only the first {report.leadsChecked.toLocaleString()} contacts were checked.</p>}
            <p className="text-xs text-muted-foreground">
                Held emails wait in Inbox, under Held emails, until you fix them or approve the suggested fallback. Nothing is sent with an empty field.
            </p>
        </div>
    );
}
