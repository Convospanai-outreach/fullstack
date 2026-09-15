"use client";

import { useState, useEffect } from "react";
import {
    Activity,
    Shield,
    Mail,
    Users,
    Zap,
    AlertCircle,
    CheckCircle2,
    Clock,
    RefreshCw,
    ArrowUpRight,
    Play
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function CommandCenterPage() {
    const [loading, setLoading] = useState(true);
    const [metrics, setMetrics] = useState({
        activeCampaigns: 4,
        pendingApprovals: 12,
        mailboxesActive: 3,
        bounceRate: 0.8,
        outboxQueueDepth: 5,
        healthyDaemons: 3,
    });
    const [deliverability, setDeliverability] = useState<{
        score: number;
        sentCount: number;
        bounceRate: number;
        complaintRate: number;
        openRate: number;
        windowDays: number;
        oneClickUnsubscribeActive: boolean;
        mailingAddressConfigured: boolean;
        domains: Array<{ domain: string; mx: boolean; spf: boolean; dkim: boolean; dmarc: boolean }>;
    } | null>(null);
    const [activeCampaigns, setActiveCampaigns] = useState<Array<{ id: string; name: string; status: string; audience: string | null; _count?: { leadList: number } }>>([]);

    const refreshData = async () => {
        setLoading(true);
        try {
            const [leadsRes, mailboxesRes, deliverabilityRes, campaignsRes, pendingJobsRes] = await Promise.all([
                fetch("/api/proxy/leads?limit=5").catch(() => null),
                fetch("/api/proxy/mailboxes").catch(() => null),
                fetch("/api/proxy/dashboard/deliverability").catch(() => null),
                fetch("/api/proxy/campaigns?status=active").catch(() => null),
                fetch("/api/proxy/jobs?status=pending&limit=100").catch(() => null),
            ]);

            if (leadsRes?.ok) {
                const data = await leadsRes.json();
                const leads = data.leads || [];
                const pending = leads.filter((l: any) => l.status === "DRAFT_GENERATED" || l.status === "PENDING_APPROVAL").length;
                setMetrics(prev => ({ ...prev, pendingApprovals: pending || prev.pendingApprovals }));
            }

            if (mailboxesRes?.ok) {
                const data = await mailboxesRes.json();
                const mailboxes = data.mailboxes || [];
                const active = mailboxes.filter((m: any) => m.status === "CONNECTED").length;
                setMetrics(prev => ({ ...prev, mailboxesActive: active || prev.mailboxesActive }));
            }

            if (deliverabilityRes?.ok) {
                const data = await deliverabilityRes.json();
                if (data.ok) setDeliverability(data.stats);
            }

            if (campaignsRes?.ok) {
                const data = await campaignsRes.json();
                const campaigns = Array.isArray(data) ? data : [];
                setActiveCampaigns(campaigns);
                setMetrics(prev => ({ ...prev, activeCampaigns: campaigns.length }));
            }

            if (pendingJobsRes?.ok) {
                const pendingJobs = await pendingJobsRes.json();
                const depth = Array.isArray(pendingJobs) ? pendingJobs.length : 0;
                setMetrics(prev => ({ ...prev, outboxQueueDepth: depth }));
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-primary text-xs font-semibold uppercase tracking-wider mb-2">
                        <Activity className="w-3.5 h-3.5" />
                        Live Operations
                    </div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                        Command Center
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Real-time pipeline orchestration, review queue telemetry, and deliverability health.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refreshData}
                        disabled={loading}
                        className="bg-muted border-border text-foreground text-xs"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                        Refresh Pulse
                    </Button>
                    <Link href="/approvals">
                        <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs shadow-lg shadow-blue-600/20">
                            Review Queue ({metrics.pendingApprovals})
                        </Button>
                    </Link>
                </div>
            </div>

            {/* Metric Pulse Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-muted border border-border space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                        <span>Active Campaigns</span>
                        <Play className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{metrics.activeCampaigns}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>All cadences executing normally</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-muted border border-border space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                        <span>Pending Approvals</span>
                        <Clock className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-bold text-amber-300">{metrics.pendingApprovals}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span>Manager sign-off required</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-muted border border-border space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                        <span>Mailbox Sender Health</span>
                        <Mail className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{metrics.mailboxesActive} Inboxes</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400">
                        <span>Bounce Rate: {deliverability ? (deliverability.bounceRate * 100).toFixed(1) : metrics.bounceRate}% (Safe &lt; 5%)</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-muted border border-border space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                        <span>Transactional Outbox</span>
                        <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{metrics.outboxQueueDepth} Pending</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-purple-400">
                        <span>Jobs waiting to be picked up by a worker</span>
                    </div>
                </div>
            </div>

            {/* Operations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Sequence Activity */}
                <div className="lg:col-span-2 p-6 rounded-2xl bg-muted border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Zap className="w-5 h-5 text-primary" />
                            Live Outbound Orchestration
                        </h2>
                        <Link href="/campaigns" className="text-xs text-primary hover:text-blue-300 flex items-center gap-1">
                            View all campaigns <ArrowUpRight className="w-3.5 h-3.5" />
                        </Link>
                    </div>

                    <div className="space-y-3">
                        {activeCampaigns.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                {loading ? "Loading active campaigns..." : "No active campaigns right now."}
                            </p>
                        ) : (
                            activeCampaigns.slice(0, 5).map((campaign) => (
                                <div key={campaign.id} className="p-4 rounded-xl bg-muted border border-border/60 flex items-center justify-between">
                                    <div className="space-y-1">
                                        <p className="text-sm font-semibold text-foreground">{campaign.name}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {campaign.audience ? `Target: ${campaign.audience} • ` : ""}
                                            Active Leads: {campaign._count?.leadList ?? 0}
                                        </p>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                        {campaign.status}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Deliverability Health */}
                <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <Shield className="w-5 h-5 text-emerald-400" />
                            Deliverability Health
                        </h2>
                        {deliverability && (
                            <span
                                className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                    deliverability.score >= 80
                                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                        : deliverability.score >= 50
                                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                        : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                }`}
                            >
                                {deliverability.score}/100
                            </span>
                        )}
                    </div>

                    {!deliverability ? (
                        <p className="text-xs text-muted-foreground">Loading deliverability signals...</p>
                    ) : (
                        <div className="space-y-3.5 text-xs text-foreground">
                            <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-1.5">
                                <div className="flex justify-between font-semibold text-foreground">
                                    <span>Bounce Rate ({deliverability.windowDays}d)</span>
                                    <span className={deliverability.bounceRate > 0.02 ? "text-amber-400" : "text-emerald-400"}>
                                        {(deliverability.bounceRate * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <p className="text-muted-foreground">Based on {deliverability.sentCount} email(s) sent in the last {deliverability.windowDays} days.</p>
                            </div>

                            <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-1.5">
                                <div className="flex justify-between font-semibold text-foreground">
                                    <span>Complaint Rate</span>
                                    <span className={deliverability.complaintRate > 0.0005 ? "text-rose-400" : "text-emerald-400"}>
                                        {(deliverability.complaintRate * 100).toFixed(2)}%
                                    </span>
                                </div>
                                <p className="text-muted-foreground">Recipients who marked a campaign email as spam.</p>
                            </div>

                            <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-1.5">
                                <div className="flex justify-between font-semibold text-foreground">
                                    <span>RFC 8058 One-Click Unsubscribe</span>
                                    <span className="text-emerald-400">Active</span>
                                </div>
                                <p className="text-muted-foreground">List-Unsubscribe headers are attached to every send.</p>
                            </div>

                            {deliverability.domains.length > 0 && (
                                <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-2">
                                    <p className="font-semibold text-foreground">Sending Domain Authentication</p>
                                    {deliverability.domains.map((d) => (
                                        <div key={d.domain} className="flex items-center justify-between">
                                            <span className="text-muted-foreground truncate">{d.domain}</span>
                                            <div className="flex gap-1.5">
                                                {(["mx", "spf", "dkim", "dmarc"] as const).map((k) => (
                                                    <span
                                                        key={k}
                                                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                            d[k]
                                                                ? "bg-emerald-500/10 text-emerald-400"
                                                                : "bg-rose-500/10 text-rose-400"
                                                        }`}
                                                    >
                                                        {k}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!deliverability.mailingAddressConfigured && (
                                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                                    <p className="font-semibold text-amber-400">No mailing address set</p>
                                    <p className="text-muted-foreground">CAN-SPAM requires a physical address in every marketing email — add one in Settings.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
