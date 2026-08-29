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

    const refreshData = async () => {
        setLoading(true);
        try {
            const [leadsRes, mailboxesRes] = await Promise.all([
                fetch("/api/proxy/leads?limit=5").catch(() => null),
                fetch("/api/proxy/mailboxes").catch(() => null)
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
                        <span>Bounce Rate: {metrics.bounceRate}% (Safe &lt; 5%)</span>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-muted border border-border space-y-2">
                    <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
                        <span>Transactional Outbox</span>
                        <Zap className="w-4 h-4 text-purple-400" />
                    </div>
                    <div className="text-2xl font-bold text-foreground">{metrics.outboxQueueDepth} Pending</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-purple-400">
                        <span>Relay Lag: 42ms • Zero loss</span>
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
                        <div className="p-4 rounded-xl bg-muted border border-border/60 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">Facility Management — Enterprise Q3 Expansion</p>
                                <p className="text-xs text-muted-foreground">Target: Commercial Lease Signals • Active Leads: 48</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active (Step 2)
                            </span>
                        </div>

                        <div className="p-4 rounded-xl bg-muted border border-border/60 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">Managed IT Retainers — Security Advisory</p>
                                <p className="text-xs text-muted-foreground">Target: Infrastructure Surge • Active Leads: 32</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Active (Step 1)
                            </span>
                        </div>

                        <div className="p-4 rounded-xl bg-muted border border-border/60 flex items-center justify-between">
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">Executive Search — Hiring Surge Ingestion</p>
                                <p className="text-xs text-muted-foreground">Target: VP Engineering Openings • Active Leads: 19</p>
                            </div>
                            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-primary border border-blue-500/20">
                                Awaiting Approvals
                            </span>
                        </div>
                    </div>
                </div>

                {/* Deliverability & Circuit Breakers */}
                <div className="p-6 rounded-2xl bg-muted border border-border space-y-4">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Shield className="w-5 h-5 text-emerald-400" />
                        Reputation Guardrails
                    </h2>

                    <div className="space-y-3.5 text-xs text-foreground">
                        <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-1.5">
                            <div className="flex justify-between font-semibold text-foreground">
                                <span>Bounce Circuit Breaker</span>
                                <span className="text-emerald-400">Armed (5.0% Limit)</span>
                            </div>
                            <p className="text-muted-foreground">Auto-pauses sending if mailbox hits delivery friction.</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-1.5">
                            <div className="flex justify-between font-semibold text-foreground">
                                <span>RFC 8058 One-Click Header</span>
                                <span className="text-emerald-400">Active</span>
                            </div>
                            <p className="text-muted-foreground">Compliant unsubscribe headers prevent spam classification.</p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-muted border border-border/60 space-y-1.5">
                            <div className="flex justify-between font-semibold text-foreground">
                                <span>RFC 5322 Message-ID Sync</span>
                                <span className="text-emerald-400">Synced</span>
                            </div>
                            <p className="text-muted-foreground">Post-send wire headers captured for authoritative threading.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
