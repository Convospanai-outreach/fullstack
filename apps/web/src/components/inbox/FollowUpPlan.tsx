"use client";

import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { Textarea } from "@/components/ui/textarea";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

const labels: Record<string, string> = {
    active: "Active", paused: "Paused", decision: "Needs your decision", completed: "Completed", cancelled: "Cancelled",
    draft: "Draft waiting", queued: "Approved and queued", dispatching: "Sending", sent: "Sent", skipped: "Skipped", blocked: "Blocked",
    succeeded: "Sent", dead_lettered: "Failed", pending: "Approved and queued", running: "Sending", processing: "Sending",
};

const reasons: Record<string, string> = {
    new_inbound: "A new reply arrived.", body_missing: "The reply body is unavailable.", opt_out_language: "The reply may ask you to stop contacting them.",
    classification_uncertain: "The latest classification needs review.", classification_unavailable: "The reply could not be classified.",
    classification_changed: "The reply classification changed.", thread_changed: "A newer email changed this thread.", approval_stale: "The approval expired.",
    team_master_off: "Follow-up plans were turned off in Settings.", feature_off: "Follow-up plans are disabled.",
    campaign_paused: "The campaign is paused.", hold_too_long: "The step has been held for too long.",
    account_cooldown: "Another contact at this account replied recently.", mailbox_limit: "The mailbox reached a sending limit.",
    send_window: "The current time is outside sending hours.", sending_time_changed: "Review the new sending time and approve again.",
    dispatch_unconfirmed: "May already have been sent. Confirm with the provider before sending again.",
    manual_reply: "Manual reply", manual_outcome: "Manual outcome change", manual_status_change: "Manual lead status change",
};

function reasonText(reason: string) {
    return reasons[reason] ?? reason.replaceAll("_", " ");
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(getBrowserApiUrl(path), init);
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update the reply flow.");
    return data;
}

function patch<T>(path: string, body: Record<string, unknown>) {
    return json<T>(path, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

type PlanStep = { dueAt: number; holdUntil: number | null; status: string; content: string; reason: string | null; revision: number };
type Plan = {
    runId: string; status: string; reason: string | null; steps: PlanStep[];
    history: { action: string; createdAt: string; user: { name: string | null } | null; metadata: { reason?: string } | null }[];
};

function dateInput(timestamp: number) {
    return format(new Date(timestamp), "yyyy-MM-dd'T'HH:mm");
}

export function FollowUpPlan({ replyId, enabled }: { replyId: string; enabled: boolean }) {
    const path = `/inbox/replies/${encodeURIComponent(replyId)}/follow-up-plan`;
    const { data, error, mutate } = useSWR<{ plan: Plan | null }>(path, json, { refreshInterval: 30_000 });
    const [editing, setEditing] = useState<number | null>(null);
    const [content, setContent] = useState("");
    const [timing, setTiming] = useState("");
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const plan = data?.plan;
    if (!plan) return error ? <p role="alert" className="text-sm text-destructive">Could not load the follow-up plan.</p> : null;

    async function act(action: string, extra: Record<string, unknown> = {}) {
        if (!plan) return;
        setBusy(true);
        setActionError(null);
        try {
            await mutate(await patch(path, { runId: plan.runId, action: { action, ...extra } }), { revalidate: false });
            setEditing(null);
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Could not update the follow-up plan.");
        } finally {
            setBusy(false);
        }
    }

    if (plan.status === "corrupt") return <GlassCard className="space-y-3 p-4">
        <h4 className="font-semibold">Follow-up plan</h4>
        <p role="alert" className="text-sm text-destructive">Plan unreadable. Take over this conversation to cancel queued follow-ups.</p>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("takeover")}>Take over</Button>
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
    </GlassCard>;
    const closed = plan.status === "cancelled" || plan.status === "completed";
    const cancelledBy = plan.status === "cancelled" && plan.reason?.startsWith("manual_")
        ? plan.history.find(entry => entry.action === "cancelled")?.user?.name : null;
    return (
        <GlassCard className="space-y-3 p-4">
            <div>
                <h4 className="font-semibold">Follow-up plan</h4>
                <p className="text-sm text-muted-foreground">{labels[plan.status] ?? plan.status}{cancelledBy ? ` · Manual action by ${cancelledBy}` : plan.reason ? ` · ${reasonText(plan.reason)}` : ""}</p>
            </div>
            {plan.status === "decision" && <p role="status" className="rounded border border-border bg-muted p-2 text-sm">Review the thread before resuming. No queued follow-up will send while a decision is needed.</p>}
            {!closed && <div className="flex flex-wrap gap-2">
                {plan.status === "active" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("pause")}>Pause all</Button>
                    : <Button size="sm" variant="outline" disabled={busy || !enabled || plan.steps.some(step => step.status === "dispatching")} onClick={() => void act("resume")}>Resume</Button>}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("cancel")}>Cancel plan</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("takeover")}>Take over</Button>
            </div>}
            {plan.steps.map((step, index) => (
                <div key={index} className="space-y-2 border-t border-border pt-3">
                    <p className="text-sm font-medium">Step {index + 1} · {step.status === "dispatching" && plan.status !== "active" ? "May already have been sent" : labels[step.status] ?? step.status}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(step.dueAt), "d MMM, h:mm a")}{step.reason ? ` · ${reasonText(step.reason)}` : ""}</p>
                    {step.holdUntil && <p className="text-xs text-muted-foreground">Next eligible time is {format(new Date(step.holdUntil), "d MMM, h:mm a")}.</p>}
                    {!closed && !["sent", "skipped", "cancelled", "dispatching"].includes(step.status) && (
                        editing === index ? <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">If you already replied outside CraftMyFunnel, take over this plan.</p>
                            <Textarea aria-label="Follow-up text" value={content} onChange={e => setContent(e.target.value)} maxLength={2200} />
                            <input aria-label="Planned send time" className="rounded border border-border bg-background p-2 text-xs" type="datetime-local" value={timing} onChange={e => setTiming(e.target.value)} />
                            <div className="flex flex-wrap gap-2">
                                <Button size="sm" variant="outline" disabled={busy || !content.trim()} onClick={() => void act("edit", { step: index, content })}>Save draft</Button>
                                <Button size="sm" variant="outline" disabled={busy || !timing} onClick={() => void act("reschedule", { step: index, dueAt: new Date(timing).getTime() })}>Reschedule</Button>
                                <Button size="sm" disabled={busy || !enabled || plan.status !== "active" || !content.trim() || !timing} onClick={() => void act("approve", { step: index, content, dueAt: new Date(timing).getTime(), revision: step.revision })}>Approve and schedule</Button>
                                <Button size="sm" variant="outline" disabled={busy || !enabled || plan.status !== "active" || !content.trim()} onClick={() => void act("approve", { step: index, content, dueAt: Date.now(), revision: step.revision })}>Send now</Button>
                            </div>
                        </div> : <div className="flex gap-2">
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditing(index); setContent(step.content); setTiming(dateInput(Math.max(step.dueAt, step.holdUntil ?? 0))); }}>Edit text or timing</Button>
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => void act("skip", { step: index })}>Skip this step</Button>
                        </div>
                    )}
                </div>
            ))}
            {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
            {plan.history.length > 0 && <details className="text-xs text-muted-foreground">
                <summary>Plan history</summary>
                <ul className="mt-2 space-y-1">{plan.history.map((entry, index) => <li key={index}>
                    {format(new Date(entry.createdAt), "d MMM, h:mm a")} · {entry.user?.name || "System"} · {entry.action}
                    {entry.metadata?.reason ? ` · ${reasonText(entry.metadata.reason)}` : ""}
                </li>)}</ul>
            </details>}
        </GlassCard>
    );
}

type OutboxItem = { id: string; messageId: string; runId: string | null; step: number | null; recipient: string | null; sendAt: string; status: string };

export function ReplyOutbox() {
    const { data, error, mutate } = useSWR<{ items: OutboxItem[] }>("/inbox/outbox", json, { refreshInterval: 30_000 });
    const [actionError, setActionError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    async function cancel(item: OutboxItem) {
        setBusy(item.id);
        setActionError(null);
        try {
            const path = `/inbox/replies/${encodeURIComponent(item.messageId)}`;
            if (item.step === null) await json(`${path}/reply`, { method: "DELETE" });
            else if (item.runId) await patch(`${path}/follow-up-plan`, { runId: item.runId, action: { action: "skip", step: item.step } });
            await mutate();
        } catch (err) {
            setActionError(err instanceof Error ? err.message : "Could not change the scheduled reply.");
        } finally {
            setBusy(null);
        }
    }
    return <GlassCard className="space-y-3 p-4">
        <h3 className="font-semibold">Outbox</h3>
        {error && <p role="alert" className="text-sm text-destructive">Could not load the Outbox.</p>}
        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
        {!error && !data && <p className="text-sm text-muted-foreground">Loading scheduled replies…</p>}
        {data?.items.length === 0 && <p className="text-sm text-muted-foreground">No scheduled or recent replies.</p>}
        {data?.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <div>
                <Link href={`/inbox?reply=${encodeURIComponent(item.messageId)}`} className="text-sm text-primary underline">{item.recipient || "Open conversation"}</Link>
                <p className="text-xs text-muted-foreground">{format(new Date(item.sendAt), "d MMM, h:mm a")} · {labels[item.status] ?? item.status}</p>
            </div>
            {(["queued", "pending"].includes(item.status) || (["blocked", "draft"].includes(item.status) && item.step !== null)) && (
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void cancel(item)}>{item.step === null ? "Cancel" : "Skip step"}</Button>
            )}
        </div>)}
    </GlassCard>;
}
