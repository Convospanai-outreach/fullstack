"use client";

import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { GlassCard } from "@/components/ui/GlassCard";
import { getBrowserApiBase } from "@/lib/api/browserBase";
import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { DNS_PROPAGATION_NOTE } from "@/lib/domainSetup";

const API_BASE = getBrowserApiBase();

type DomainHealthEntry = {
    domain: string;
    mx: boolean;
    spf: boolean;
    dkim: boolean;
    dmarc: boolean;
    active: boolean;
    score: number;
    label: "Healthy" | "At Risk" | "Poor";
    lastActiveAt: string | null;
};

type DeliverabilityStats = {
    score: number;
    bounceRate: number;
    complaintRate: number;
    sentCount: number;
    windowDays: number;
    resendDelivery?: { sent: number; delivered: number; delayed: number; failed: number; unconfirmed: number };
    domains: DomainHealthEntry[];
};

function LabelBadge({ label }: { label: DomainHealthEntry["label"] }) {
    const styles = {
        Healthy: "bg-success/15 text-success dark:text-success",
        "At Risk": "bg-warning/15 text-warning dark:text-warning",
        Poor: "bg-destructive/15 text-destructive dark:text-destructive",
    } as const;
    const Icon = label === "Healthy" ? ShieldCheck : label === "At Risk" ? ShieldAlert : ShieldX;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${styles[label]}`}>
            <Icon className="w-3.5 h-3.5" aria-hidden="true" />
            {label}
        </span>
    );
}

function RecordCell({ ok }: { ok: boolean }) {
    return (
        <span className={ok ? "text-success dark:text-success" : "text-destructive dark:text-destructive"}>
            {ok ? "OK" : "Missing"}
        </span>
    );
}

export default function DomainHealthPage() {
    const [stats, setStats] = useState<DeliverabilityStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cooldown, setCooldown] = useState<{ hours: number; canEdit: boolean } | null>(null);
    const [savingCooldown, setSavingCooldown] = useState(false);
    const [cooldownError, setCooldownError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(`${API_BASE}/dashboard/deliverability`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const json = await res.json();
                if (!json.ok) throw new Error(json.error || "Failed to load domain health.");
                if (!cancelled) setStats(json.stats);
            } catch (e: any) {
                if (!cancelled) setError(e.message || "Failed to load domain health.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        fetch(`${API_BASE}/settings/account-reply-cooldown`, { signal: controller.signal })
            .then(async (response) => { if (response.ok) setCooldown(await response.json()); })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    async function saveCooldown(hours: number) {
        setSavingCooldown(true);
        setCooldownError("");
        try {
            const response = await fetch(`${API_BASE}/settings/account-reply-cooldown`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hours }),
            });
            if (!response.ok) throw new Error("Could not save the account reply cooldown.");
            setCooldown((current) => current ? { ...current, hours } : current);
        } catch {
            setCooldownError("Could not save the account reply cooldown.");
        } finally {
            setSavingCooldown(false);
        }
    }

    const activeDomains = stats?.domains.filter((d) => d.active) || [];
    const retiredDomains = stats?.domains.filter((d) => !d.active) || [];

    return (
        <div className="space-y-6 max-w-4xl mr-auto">
            <SectionHeader
                title="Domain Health"
                subtitle="Sender reputation for every domain you've sent cold outreach from — SPF/DKIM/DMARC, bounce and complaint signals. These are your emails at stake; a domain that goes bad here hurts every campaign sent from it."
            />

            {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs p-4">
                    {error}
                </div>
            )}

            {loading && !error && <p className="text-sm text-muted-foreground">Loading...</p>}

            {cooldown && (
                <GlassCard className="p-6 space-y-2">
                    <label htmlFor="account-reply-cooldown" className="block text-sm font-bold text-foreground">Account reply cooldown</label>
                    <p className="text-xs text-muted-foreground">Pause scheduled outreach to other contacts at the same company when someone replies. Contacts need a company domain on their record.</p>
                    <select id="account-reply-cooldown" value={cooldown.hours} disabled={!cooldown.canEdit || savingCooldown}
                        onChange={(event) => void saveCooldown(Number(event.target.value))} className="rounded border border-border bg-background p-2 text-sm">
                        <option value={0}>Off</option><option value={24}>24 hours</option><option value={48}>48 hours</option><option value={72}>72 hours</option>
                    </select>
                    {cooldownError && <p role="alert" className="text-xs text-destructive">{cooldownError}</p>}
                </GlassCard>
            )}

            {!loading && !error && stats && (
                <>
                    <GlassCard className="p-6 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Overall deliverability score</p>
                            <p className="text-3xl font-bold text-foreground mt-1">{stats.score}<span className="text-base text-muted-foreground">/100</span></p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground space-y-1">
                            <p>Bounce rate: {(stats.bounceRate * 100).toFixed(2)}%</p>
                            <p>Complaint rate: {(stats.complaintRate * 100).toFixed(3)}%</p>
                            <p>Last {stats.windowDays} days · {stats.sentCount} sent</p>
                        </div>
                    </GlassCard>

                    {stats.resendDelivery && stats.resendDelivery.sent > 0 && (
                        <GlassCard className="p-6 space-y-3">
                            <h3 className="text-sm font-bold text-foreground">Resend delivery in the last {stats.windowDays} days</h3>
                            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5">
                                {[
                                    ["Submitted", stats.resendDelivery.sent], ["Delivered to mail server", stats.resendDelivery.delivered],
                                    ["Delayed", stats.resendDelivery.delayed], ["Failed or bounced", stats.resendDelivery.failed],
                                    ["Unconfirmed", stats.resendDelivery.unconfirmed],
                                ].map(([label, value]) => (
                                    <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>
                                ))}
                            </dl>
                            <p className="text-xs text-muted-foreground">These are Resend webhook results. Inbox folder placement requires a separate test.</p>
                        </GlassCard>
                    )}

                    <GlassCard className="p-6 space-y-4">
                        <div className="flex items-center justify-between gap-3">
                            <h3 className="text-sm font-bold text-foreground">Active sending domains</h3>
                            <Link href="/setup?step=3" className="text-xs font-semibold text-primary hover:underline">Add another domain</Link>
                        </div>
                        <p className="text-xs text-muted-foreground">If a domain's health drops, connect a mailbox on a new domain and move campaigns over. {DNS_PROPAGATION_NOTE}</p>
                        {activeDomains.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No connected mailboxes yet — connect one in Settings &gt; Connected Mailboxes.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                                            <th className="pb-2 pr-4">Domain</th>
                                            <th className="pb-2 px-2">SPF</th>
                                            <th className="pb-2 px-2">DKIM</th>
                                            <th className="pb-2 px-2">DMARC</th>
                                            <th className="pb-2 px-2">MX</th>
                                            <th className="pb-2 pl-2">Health</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {activeDomains.map((d) => (
                                            <tr key={d.domain} className="border-t border-border">
                                                <td className="py-2 pr-4 font-medium text-foreground">{d.domain}</td>
                                                <td className="py-2 px-2"><RecordCell ok={d.spf} /></td>
                                                <td className="py-2 px-2"><RecordCell ok={d.dkim} /></td>
                                                <td className="py-2 px-2"><RecordCell ok={d.dmarc} /></td>
                                                <td className="py-2 px-2"><RecordCell ok={d.mx} /></td>
                                                <td className="py-2 pl-2"><LabelBadge label={d.label} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </GlassCard>

                    {retiredDomains.length > 0 && (
                        <GlassCard className="p-6 space-y-4">
                            <h3 className="text-sm font-bold text-foreground">Retired domains</h3>
                            <p className="text-xs text-muted-foreground">
                                No longer connected to an active mailbox, but kept here since a domain sometimes
                                degrades after it's dropped — worth checking before ever reusing one.
                            </p>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs text-muted-foreground uppercase tracking-wide">
                                            <th className="pb-2 pr-4">Domain</th>
                                            <th className="pb-2 px-2">SPF</th>
                                            <th className="pb-2 px-2">DKIM</th>
                                            <th className="pb-2 px-2">DMARC</th>
                                            <th className="pb-2 px-2">Last active</th>
                                            <th className="pb-2 pl-2">Health</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {retiredDomains.map((d) => (
                                            <tr key={d.domain} className="border-t border-border opacity-80">
                                                <td className="py-2 pr-4 font-medium text-foreground">{d.domain}</td>
                                                <td className="py-2 px-2"><RecordCell ok={d.spf} /></td>
                                                <td className="py-2 px-2"><RecordCell ok={d.dkim} /></td>
                                                <td className="py-2 px-2"><RecordCell ok={d.dmarc} /></td>
                                                <td className="py-2 px-2 text-muted-foreground">
                                                    {d.lastActiveAt ? new Date(d.lastActiveAt).toLocaleDateString() : "Unknown"}
                                                </td>
                                                <td className="py-2 pl-2"><LabelBadge label={d.label} /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </GlassCard>
                    )}
                </>
            )}
        </div>
    );
}
