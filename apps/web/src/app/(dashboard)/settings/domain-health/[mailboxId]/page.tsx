"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/GlassCard";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { getBrowserApiUrl } from "@/lib/api/browserBase";

type Counts = { sent: number; bounced: number; complained: number; delayed: number; failed: number };
type Mailbox = { id: string; email: string; status: string; isWarmingUp: boolean; warmupDay: number; warmupTargetDays: number; placementLevel?: "green" | "amber" | "red" };
type Detail = {
    canEdit: boolean;
    guardEnabled: boolean;
    mailbox: Mailbox & { reputation: {
        level?: string; state?: string; switchedAt?: string; sendingHold?: { since: string; reason: string };
        mailboxCounts?: Counts; teamCounts?: Counts; domainCounts?: Counts; providerCounts?: Record<string, Counts>;
        signals?: Array<{ code: string; level: string; count?: number; sent?: number; recipientProvider?: string }>;
        replacement?: { id: string; readyAt?: string; dns?: { spf: boolean; dkim: boolean; dmarc: boolean } };
    } };
    history: Array<{ id: string; checkedAt: string; status: string; sentLast24h: number; complainedLast24h: number; bouncedLast24h: number }>;
    campaigns: Array<{ id: string; name: string; status: string }>;
    candidates: Mailbox[];
};

const formatDate = (value: string) => new Date(value).toLocaleString();
const label = (value: string) => value.replaceAll("_", " ").toLowerCase();
const rate = (value: number, sent: number) => sent ? (100 * value / sent).toFixed(2) + "%" : "—";

function Rates({ data }: { data: Counts }) {
    return <span>{data.sent} sends · {rate(data.bounced, data.sent)} bounced · {rate(data.complained, data.sent)} complaints · {rate(data.delayed, data.sent)} delayed · {rate(data.failed, data.sent)} failed</span>;
}

export default function MailboxReputationPage() {
    const { mailboxId } = useParams<{ mailboxId: string }>();
    const url = getBrowserApiUrl("/settings/mailbox-reputation/" + encodeURIComponent(mailboxId));
    const [data, setData] = useState<Detail | null>(null);
    const [replacementId, setReplacementId] = useState("");
    const [confirmation, setConfirmation] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        const refresh = () => fetch(url, { signal: controller.signal, cache: "no-store" })
            .then(async (response) => {
                if (!response.ok) throw new Error("Could not load mailbox health.");
                const next: Detail = await response.json();
                if (!controller.signal.aborted) setData(next);
            }).catch(() => { if (!controller.signal.aborted) setError("Could not load mailbox health."); });
        void refresh();
        const timer = setInterval(() => void refresh(), 60_000);
        return () => { controller.abort(); clearInterval(timer); };
    }, [url]);

    async function act(action: string) {
        setBusy(true);
        setError("");
        try {
            const response = await fetch(url, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, replacementId, confirmation }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Could not update mailbox health.");
            setData(result);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not update mailbox health.");
        } finally {
            setBusy(false);
        }
    }

    const reputation = data?.mailbox.reputation;
    const replacement = reputation?.replacement;
    const candidate = data?.candidates.find((mailbox) => mailbox.id === replacement?.id);
    const remaining = candidate ? Math.max(0, candidate.warmupTargetDays - candidate.warmupDay) : 0;
    const canResume = reputation?.level === "OK" && reputation.sendingHold && !reputation.switchedAt
        && Date.now() - Date.parse(reputation.sendingHold.since) >= 14 * 86_400_000;
    const canDisconnect = data?.mailbox.status === "CONNECTED" && reputation?.switchedAt
        && Date.now() - Date.parse(reputation.switchedAt) >= 30 * 86_400_000;

    return <div className="max-w-4xl space-y-6">
        <Link href="/settings/domain-health" className="text-sm text-primary underline">Domain Health</Link>
        <SectionHeader title={data?.mailbox.email ?? "Mailbox health"} subtitle={data && !data.guardEnabled ? "Automatic reputation guard is off" : reputation?.level ? "Reputation " + reputation.level.toLowerCase() : "Reputation check pending"} />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!data && !error && <p className="text-sm text-muted-foreground">Loading mailbox health…</p>}
        {data && reputation && <>
            <GlassCard className="space-y-3 p-5">
                <h2 className="text-base font-semibold">Reputation signals over seven days</h2>
                {reputation.sendingHold && <p className="text-sm text-destructive" role="status">Sending held since {formatDate(reputation.sendingHold.since)}. {reputation.sendingHold.reason}</p>}
                <div className="space-y-1 text-sm">
                    {reputation.mailboxCounts && <div><strong>Mailbox</strong> <Rates data={reputation.mailboxCounts} /></div>}
                    {reputation.domainCounts && <div><strong>Sending domain</strong> <Rates data={reputation.domainCounts} /></div>}
                    {reputation.teamCounts && <div><strong>Team</strong> <Rates data={reputation.teamCounts} /></div>}
                    {Object.entries(reputation.providerCounts ?? {}).map(([provider, counts]) => <div key={provider}><strong className="capitalize">{provider}</strong> <Rates data={counts} /></div>)}
                </div>
                <ul className="space-y-1 text-sm">
                    {reputation.signals?.map((signal) => <li key={signal.code + signal.recipientProvider}>
                        {signal.level}: {label(signal.code)}{signal.recipientProvider ? " · " + signal.recipientProvider : ""}{signal.count !== undefined ? " · " + signal.count + " of " + signal.sent + " sends" : ""}
                    </li>)}
                </ul>
                {data.campaigns.length > 0 && <div className="text-sm">
                    <h3 className="font-medium">Affected campaigns</h3>
                    <ul>{data.campaigns.map((campaign) => <li key={campaign.id}>{campaign.name} · {campaign.status}</li>)}</ul>
                </div>}
            </GlassCard>
            <GlassCard className="space-y-4 p-5">
                <h2 className="text-base font-semibold">Fix mailbox</h2>
                {replacement && <ol className="space-y-2 text-sm">
                    <li>Mailbox {candidate?.email ?? "selected"}</li>
                    <li>DNS {replacement.dns ? Object.entries(replacement.dns).map(([record, ok]) => record.toUpperCase() + (ok ? " passed" : " needs attention")).join(", ") : "check pending"}</li>
                    <li>Warmup {candidate?.isWarmingUp ? "day " + candidate.warmupDay + " of " + candidate.warmupTargetDays + ". Estimated ready " + formatDate(new Date(Date.now() + remaining * 86_400_000).toISOString()) : "ramp complete or awaiting a health check"}</li>
                    <li>Inbox placement {candidate?.placementLevel === "green" ? "passed" : "needs a green result"} · <Link href="/settings/mailboxes" className="text-primary underline">Run a placement check</Link></li>
                    {replacement.readyAt && <li>Switch {reputation.switchedAt ? "completed" : "scheduled"} for {formatDate(replacement.readyAt)}</li>}
                </ol>}
                {data.canEdit ? <div className="flex flex-wrap items-end gap-3">
                    {reputation.sendingHold && !replacement && !reputation.switchedAt && <>
                        <label className="space-y-1 text-sm">
                            <span className="block">Replacement mailbox</span>
                            <select value={replacementId} onChange={(event) => setReplacementId(event.target.value)} className="rounded border border-border bg-background p-2">
                                <option value="">Choose a different domain</option>
                                {data.candidates.map((mailbox) => <option key={mailbox.id} value={mailbox.id}>{mailbox.email}</option>)}
                            </select>
                        </label>
                        <Button disabled={busy || !replacementId} onClick={() => void act("switch")}>Approve automatic switch</Button>
                        <Link href="/settings/mailboxes" className="text-sm text-primary underline">Connect a mailbox and set up DNS</Link>
                    </>}
                    {reputation.state === "SWITCH_SCHEDULED" && <Button variant="outline" disabled={busy} onClick={() => void act("delay")}>Delay one day</Button>}
                    {data.mailbox.status === "CONNECTED" && <Button variant="outline" disabled={busy} onClick={() => void act("recheck")}>Recheck DNS and reputation</Button>}
                    {reputation.level === "WARNING" && reputation.state === "OPEN" && !reputation.sendingHold && <>
                        <label className="space-y-1 text-sm">
                            <span className="block">Type KEEP SENDING to confirm</span>
                            <input className="rounded border border-border bg-background p-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
                        </label>
                        <Button variant="outline" disabled={busy || confirmation !== "KEEP SENDING"} onClick={() => void act("keep")}>Keep sending</Button>
                    </>}
                    {canResume && <Button disabled={busy} onClick={() => void act("resume")}>Resume at a low volume</Button>}
                    {canDisconnect && <Button variant="outline" disabled={busy} onClick={() => void act("disconnect")}>Disconnect old mailbox</Button>}
                </div> : <p className="text-sm text-muted-foreground">{data.guardEnabled ? "Team admins can change these settings." : "Replacement and corrective actions are unavailable while the guard is off."}</p>}
            </GlassCard>
            <GlassCard className="space-y-2 p-5">
                <h2 className="text-base font-semibold">Recent checks</h2>
                {data.history.length ? <ul className="space-y-1 text-sm">{data.history.map((snapshot) => <li key={snapshot.id}>
                    {formatDate(snapshot.checkedAt)} · {snapshot.status} · {snapshot.sentLast24h} sends, {snapshot.bouncedLast24h} bounces and {snapshot.complainedLast24h} complaints in the preceding day
                </li>)}</ul> : <p className="text-sm text-muted-foreground">No mailbox checks yet.</p>}
            </GlassCard>
        </>}
    </div>;
}
