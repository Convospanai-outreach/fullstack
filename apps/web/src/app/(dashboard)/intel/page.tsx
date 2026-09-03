"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
    Activity,
    ArrowRight,
    Bot,
    Building2,
    CircleGauge,
    Network,
    Radar,
    RadioTower,
    ShieldCheck,
    Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FeedStatus = {
    status: "active" | "stale" | "offline";
    label: string;
    lastReceivedAt: string | null;
};

type SecurityStatus = {
    status: "verified" | "shared_key";
    label: string;
    detail: string;
};

type BuyingStage = {
    stage: string;
    count: number;
};

type IndustrySummary = {
    name: string;
    count: number;
    averageStrength: number;
};

type CompanySummary = {
    name: string;
    count: number;
    averageStrength: number;
    maxIntentScore: number;
    lastReceivedAt: string | null;
};

type RecentSignal = {
    id: string;
    companyName: string;
    industry: string;
    buyingStage: string;
    intentScore: number;
    signalStrength: number;
    whyNow: string;
    whatTheyNeed: string;
    recommendedAction: string;
    temperatureBand: "HOT" | "WARM" | "COLD";
    verityTier: string | null;
    isTriangulated: boolean;
    receivedAt: string;
    event: string;
    matchStatus: "MATCHED" | "UNMATCHED";
    matchConfidence: "HIGH" | "MEDIUM" | "NONE";
    safeForAutomation: boolean;
    trustedForKnowledge: boolean;
    signatureVerified: boolean;
    verificationMode: "HMAC_VERIFIED" | "SHARED_KEY_ONLY";
};

type CreateLeadResult = { status: "success"; leadId: string } | { status: "error"; message: string };

type IntelSummary = {
    integration: {
        feed: FeedStatus;
        security: SecurityStatus;
    };
    totals: {
        signalsReceived: number;
        industries: number;
        companies: number;
        buyReadySignals: number;
        matchedSignals: number;
        unmatchedSignals: number;
        automationReadySignals: number;
        knowledgeReadySignals: number;
    };
    averages: {
        signalStrength: number;
        intentScore: number;
    };
    buyingStages: BuyingStage[];
    industries: IndustrySummary[];
    companies: CompanySummary[];
    recentSignals: RecentSignal[];
};

function formatTimestamp(value?: string | null) {
    if (!value) {
        return "No signal received yet";
    }

    return new Date(value).toLocaleString();
}

function feedVariant(status: FeedStatus["status"]) {
    if (status === "active") return "success";
    if (status === "stale") return "warning";
    return "danger";
}

function securityVariant(status: SecurityStatus["status"]) {
    return status === "verified" ? "success" : "warning";
}

function temperatureClass(temperatureBand: RecentSignal["temperatureBand"]) {
    if (temperatureBand === "HOT") return "bg-red-500/15 text-red-300";
    if (temperatureBand === "WARM") return "bg-amber-500/15 text-amber-300";
    return "bg-sky-500/15 text-sky-300";
}

export default function IntelPage() {
    const [summary, setSummary] = useState<IntelSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [creatingLeadForSignalId, setCreatingLeadForSignalId] = useState<string | null>(null);
    const [createLeadResults, setCreateLeadResults] = useState<Record<string, CreateLeadResult>>({});

    const load = async () => {
        try {
            const res = await fetch("/api/proxy/intel/summary", { cache: "no-store" });
            if (!res.ok) {
                throw new Error("Failed to load Intel summary");
            }

            const data = await res.json();
            setSummary(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || "Failed to load Intel summary");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            if (cancelled) return;
            await load();
        };

        run();
        const interval = setInterval(run, 30000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, []);

    const handleCreateLead = async (signalId: string) => {
        setCreatingLeadForSignalId(signalId);
        try {
            const res = await fetch("/api/proxy/intel/signals/create-lead", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signalId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.ok) {
                throw new Error(data.error || "Failed to create lead from signal");
            }
            setCreateLeadResults((prev) => ({ ...prev, [signalId]: { status: "success", leadId: data.leadId } }));
            await load();
        } catch (err: any) {
            setCreateLeadResults((prev) => ({
                ...prev,
                [signalId]: { status: "error", message: err.message || "Failed to create lead from signal" },
            }));
        } finally {
            setCreatingLeadForSignalId(null);
        }
    };

    const statCards = useMemo(() => {
        if (!summary) {
            return [];
        }

        return [
            {
                label: "Signals Received",
                value: summary.totals.signalsReceived,
                detail: "Accepted Netjana events stored for this workspace",
                icon: RadioTower,
            },
            {
                label: "Industries Seen",
                value: summary.totals.industries,
                detail: "Distinct industries represented in the current signal graph",
                icon: Network,
            },
            {
                label: "Companies Seen",
                value: summary.totals.companies,
                detail: "Named companies observed across incoming Intel signals",
                icon: Building2,
            },
            {
                label: "Buy-Ready Signals",
                value: summary.totals.buyReadySignals,
                detail: "Signals showing active consideration or stronger buyer intent",
                icon: Radar,
            },
            {
                label: "Matched Signals",
                value: summary.totals.matchedSignals,
                detail: "Signals mapped to an existing lead or campaign context",
                icon: Activity,
            },
            {
                label: "Automation Ready",
                value: summary.totals.automationReadySignals,
                detail: "Verified, matched signals strong enough for follow-up automation",
                icon: Bot,
            },
        ];
    }, [summary]);

    if (loading) {
        return (
            <div role="status" aria-live="polite" className="min-h-[50vh] flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary" aria-hidden="true"></div>
                    <p className="mt-2 text-sm font-medium text-foreground">Loading Intel dashboard...</p>
                </div>
            </div>
        );
    }

    if (error || !summary) {
        return (
            <div role="alert" className="p-6 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive-foreground">
                <h2 className="text-lg font-bold">Intel Dashboard Unavailable</h2>
                <p className="mt-1 text-sm">{error || "Failed to load Intel summary data."}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400 dark:text-cyan-300">Buyer Intent</p>
                    <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Netjana Intel Dashboard</h1>
                    <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                        Track incoming buyer signals, see which companies and industries are heating up, and understand what is matched, verified, and safe to use in campaign automation.
                    </p>
                </div>

                <div className="flex flex-wrap gap-3" role="region" aria-label="Integration summary indicators">
                    <Badge variant={feedVariant(summary.integration.feed.status)}>
                        {summary.integration.feed.label}
                    </Badge>
                    <Badge variant={securityVariant(summary.integration.security.status)}>
                        {summary.integration.security.label}
                    </Badge>
                    <Badge variant="info">
                        Avg strength {summary.averages.signalStrength}%
                    </Badge>
                    <Badge variant="secondary">
                        Avg intent {summary.averages.intentScore}/100
                    </Badge>
                </div>
            </header>

            <section aria-labelledby="integration-status-heading" className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
                <Card className="border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-slate-900">
                    <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-cyan-400 dark:text-cyan-300">
                                <Activity className="h-4 w-4" aria-hidden="true" />
                                <h2 id="integration-status-heading" className="text-sm font-semibold">Integration status</h2>
                            </div>
                            <p className="text-lg font-semibold text-foreground">{summary.integration.feed.label}</p>
                            <p className="text-sm text-foreground/90">Latest signal: {formatTimestamp(summary.integration.feed.lastReceivedAt)}</p>
                            <p className="text-sm text-muted-foreground">{summary.integration.security.detail}</p>
                        </div>

                        <div className="flex gap-3">
                            <Link href="/knowledge">
                                <Button variant="outline" className="gap-2">
                                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                                    Open Intel Wiki
                                </Button>
                            </Link>
                            <Link href="/campaigns">
                                <Button className="gap-2">
                                    Use In Campaigns
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-emerald-500/20 bg-emerald-500/10">
                    <CardContent className="grid gap-4 p-6 md:grid-cols-2">
                        <div>
                            <div className="flex items-center gap-2 text-emerald-300 dark:text-emerald-200">
                                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                                <h3 className="text-sm font-semibold">Knowledge ready</h3>
                            </div>
                            <p className="mt-2 text-3xl font-black text-foreground">{summary.totals.knowledgeReadySignals}</p>
                            <p className="text-sm text-foreground/90">Verified signals suitable for the small Intel wiki and retrieval context.</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-2 text-emerald-300 dark:text-emerald-200">
                                <CircleGauge className="h-4 w-4" aria-hidden="true" />
                                <h3 className="text-sm font-semibold">Needs review</h3>
                            </div>
                            <p className="mt-2 text-3xl font-black text-foreground">{summary.totals.unmatchedSignals}</p>
                            <p className="text-sm text-foreground/90">Signals that arrived but still need stronger matching or operator review before automation.</p>
                        </div>
                    </CardContent>
                </Card>
            </section>

            <section aria-labelledby="intel-kpi-heading">
                <h2 id="intel-kpi-heading" className="sr-only">Key Signal Metrics</h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <Card key={card.label}>
                                <CardHeader className="pb-3">
                                    <CardDescription>{card.label}</CardDescription>
                                    <CardTitle className="flex items-center justify-between text-3xl font-black text-foreground">
                                        {card.value}
                                        <Icon className="h-5 w-5 text-cyan-400 dark:text-cyan-300" aria-hidden="true" />
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground">{card.detail}</p>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </section>

            <section aria-labelledby="intel-clusters-heading">
                <h2 id="intel-clusters-heading" className="sr-only">Intent Clusters and Segmentation</h2>
                <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <Building2 className="h-5 w-5 text-cyan-400 dark:text-cyan-300" aria-hidden="true" />
                                Top Companies
                            </CardTitle>
                            <CardDescription>Accounts with the strongest or most frequent buyer-intent activity.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {summary.companies.length === 0 && (
                                <p className="text-sm text-muted-foreground">No company signals yet.</p>
                            )}
                            {summary.companies.map((company) => (
                                <div key={company.name} className="rounded-lg border border-border/50 bg-card p-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-foreground">{company.name}</p>
                                            <p className="text-xs text-muted-foreground">Last signal: {formatTimestamp(company.lastReceivedAt)}</p>
                                        </div>
                                        <Badge variant="info">{company.count} signal{company.count === 1 ? "" : "s"}</Badge>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                        <div className="rounded-md bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Strength</div>
                                            <div className="mt-1 font-semibold text-foreground">{company.averageStrength}%</div>
                                        </div>
                                        <div className="rounded-md bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Max intent</div>
                                            <div className="mt-1 font-semibold text-foreground">{company.maxIntentScore}/100</div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <Network className="h-5 w-5 text-primary" aria-hidden="true" />
                                Industries
                            </CardTitle>
                            <CardDescription>Where the external buyer activity is clustering right now.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {summary.industries.length === 0 && (
                                <p className="text-sm text-muted-foreground">No industry signals yet.</p>
                            )}
                            {summary.industries.map((industry) => (
                                <div key={industry.name} className="rounded-lg border border-border/50 bg-card p-4">
                                    <div className="flex items-center justify-between">
                                        <p className="font-semibold text-foreground">{industry.name}</p>
                                        <Badge variant="secondary">{industry.count}</Badge>
                                    </div>
                                    <div className="mt-3">
                                        <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.15em] text-muted-foreground">
                                            <span>Average strength</span>
                                            <span>{industry.averageStrength}%</span>
                                        </div>
                                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-primary"
                                                style={{ width: `${industry.averageStrength}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <CircleGauge className="h-5 w-5 text-primary" aria-hidden="true" />
                                Buying Stages
                            </CardTitle>
                            <CardDescription>How close the incoming companies look to active purchase motion.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {summary.buyingStages.length === 0 && (
                                <p className="text-sm text-muted-foreground">No buying-stage data yet.</p>
                            )}
                            {summary.buyingStages.map((stage) => (
                                <div key={stage.stage} className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-4">
                                    <div>
                                        <p className="font-semibold text-foreground">{stage.stage}</p>
                                        <p className="text-xs text-muted-foreground">Signals at this stage</p>
                                    </div>
                                    <Badge variant="outline">{stage.count}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </section>

            <section aria-labelledby="recent-signals-heading">
                <Card>
                    <CardHeader>
                        <CardTitle id="recent-signals-heading" className="flex items-center gap-2 text-foreground">
                            <Radar className="h-5 w-5 text-primary" aria-hidden="true" />
                            Recent Buyer Signals
                        </CardTitle>
                        <CardDescription>See the signal narrative, signal strength, connection status, and whether each item is ready for campaigns or still needs review.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {summary.recentSignals.length === 0 && (
                            <p className="text-sm text-muted-foreground">No recent Netjana signals yet.</p>
                        )}
                        {summary.recentSignals.map((signal) => {
                            const createLeadResult = createLeadResults[signal.id];
                            return (
                            <article key={signal.id} className="rounded-lg border border-border/50 bg-card p-5">
                                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <h3 className="text-lg font-semibold text-foreground">{signal.companyName}</h3>
                                            <Badge variant="secondary">{signal.industry}</Badge>
                                            <div className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${temperatureClass(signal.temperatureBand)}`}>
                                                {signal.temperatureBand}
                                            </div>
                                            <Badge variant={signal.signatureVerified ? "success" : "warning"}>
                                                {signal.signatureVerified ? "Verified" : "Needs HMAC"}
                                            </Badge>
                                            <Badge variant={signal.matchStatus === "MATCHED" ? "info" : "outline"}>
                                                {signal.matchStatus === "MATCHED" ? `Matched (${signal.matchConfidence})` : "Unmatched"}
                                            </Badge>
                                            <Badge variant={signal.safeForAutomation ? "success" : "warning"}>
                                                {signal.safeForAutomation ? "Automation ready" : "Review first"}
                                            </Badge>
                                        </div>
                                        <p className="mt-2 text-sm text-muted-foreground">Received {formatTimestamp(signal.receivedAt)}</p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm lg:min-w-[280px]">
                                        <div className="rounded-md bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Intent</div>
                                            <div className="mt-1 font-semibold text-foreground">{signal.intentScore}/100</div>
                                        </div>
                                        <div className="rounded-md bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Strength</div>
                                            <div className="mt-1 font-semibold text-foreground">{signal.signalStrength}%</div>
                                        </div>
                                        <div className="rounded-md bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Stage</div>
                                            <div className="mt-1 font-semibold text-foreground">{signal.buyingStage}</div>
                                        </div>
                                        <div className="rounded-md bg-muted/40 p-3">
                                            <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">Verity</div>
                                            <div className="mt-1 font-semibold text-foreground">{signal.verityTier || "Unknown"}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Why now</div>
                                        <p className="mt-2 text-sm leading-6 text-foreground">{signal.whyNow || "No narrative supplied."}</p>
                                    </div>
                                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">What they need</div>
                                        <p className="mt-2 text-sm leading-6 text-foreground">{signal.whatTheyNeed || "No procurement detail supplied."}</p>
                                    </div>
                                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
                                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Suggested action</div>
                                        <p className="mt-2 text-sm leading-6 text-foreground">{signal.recommendedAction || "No action guidance supplied."}</p>
                                    </div>
                                </div>

                                {signal.matchStatus === "UNMATCHED" && (
                                    <div className="mt-4 flex flex-col gap-2 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-xs text-muted-foreground">
                                            This signal did not match an existing lead. Create one to bring {signal.companyName} into your pipeline.
                                        </p>
                                        {createLeadResult?.status === "success" ? (
                                            <Badge variant="success">Lead created</Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={creatingLeadForSignalId === signal.id}
                                                onClick={() => handleCreateLead(signal.id)}
                                            >
                                                {creatingLeadForSignalId === signal.id ? "Creating..." : "Create Lead"}
                                            </Button>
                                        )}
                                    </div>
                                )}
                                {createLeadResult?.status === "error" && (
                                    <p className="mt-2 text-xs text-destructive">{createLeadResult.message}</p>
                                )}
                            </article>
                            );
                        })}
                    </CardContent>
                </Card>
            </section>
        </div>
    );
}
